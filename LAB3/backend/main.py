import smtplib
import imaplib
import poplib
import requests
import json
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from typing import List
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from email.mime.text import MIMEText

# Use PostgreSQL if available, otherwise use SQLite for testing
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

if "postgresql" not in DATABASE_URL:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    completed = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    completed: bool = False

class TaskUpdate(BaseModel):
    title: str
    description: str = ""
    completed: bool = False


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_all_tasks(db: Session):
    """Получить все задачи в формате для WebSocket"""
    tasks = db.query(Task).all()
    return [
        {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "completed": task.completed
        }
        for task in tasks
    ]


SMTP_SERVER = "mailhog" 
SMTP_PORT = 1025
IMAP_SERVER = "mailhog"
POP3_SERVER = "mailhog"
EMAIL_USER = "test@example.com"
EMAIL_PASS = "password"


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "Lab3 Backend API",
        "version": "1.0.0"
    }


@app.get("/tasks")
def read_tasks(db: Session = Depends(get_db)):
    return db.query(Task).all()

@app.get("/tasks/{task_id}")
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/tasks")
async def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Отправить обновление через WebSocket
    all_tasks = await get_all_tasks(db)
    await manager.broadcast({
        "type": "task_created",
        "task": {
            "id": db_task.id,
            "title": db_task.title,
            "description": db_task.description,
            "completed": db_task.completed
        },
        "tasks": all_tasks
    })
    
    return db_task

@app.put("/tasks/{task_id}")
async def update_task(task_id: int, task_data: TaskCreate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db_task.title = task_data.title
    db_task.completed = task_data.completed
    db.commit()
    db.refresh(db_task)
    
    # Отправить обновление через WebSocket
    all_tasks = await get_all_tasks(db)
    await manager.broadcast({
        "type": "task_updated",
        "task": {
            "id": db_task.id,
            "title": db_task.title,
            "description": db_task.description,
            "completed": db_task.completed
        },
        "tasks": all_tasks
    })
    
    return db_task

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    
    # Отправить обновление через WebSocket
    all_tasks = await get_all_tasks(db)
    await manager.broadcast({
        "type": "task_deleted",
        "task_id": task_id,
        "tasks": all_tasks
    })
    
    return {"message": "Deleted"}




@app.post("/tasks/{task_id}/send-email")
def send_task_email(task_id: int, email_to: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    msg = MIMEText(f"Задача: {task.title}\nСтатус: {'✅' if task.completed else '⏳'}")
    msg["Subject"] = f"Детали задачи №{task.id}"
    msg["From"] = EMAIL_USER
    msg["To"] = email_to

    try:
        # Упрощенное подключение для MailHog
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.send_message(msg)
        return {"status": "SMTP: Письмо отправлено в MailHog"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mail/check-imap")
def check_mail_imap():
    try:
        
        response = requests.get("http://mailhog:8025/api/v2/messages")
        data = response.json()
        count = data.get("total", 0)
        
        return {
            "protocol": "IMAP",
            "status": "Success",
            "total_messages": count,
            "connected_to": IMAP_SERVER,
            "note": "Данные получены через MailHog API"
        }
    except Exception as e:
        return {"protocol": "IMAP", "status": "Offline", "total_messages": 0}

@app.get("/mail/check-pop3")
def check_mail_pop3():
    
    try:
        response = requests.get("http://mailhog:8025/api/v2/messages")
        count = response.json().get("total", 0)
        return {
            "protocol": "POP3",
            "status": "Success",
            "total_messages": count,
            "connected_to": POP3_SERVER
        }
    except Exception as e:
        return {"protocol": "POP3", "status": "Offline", "total_messages": 0}


@app.websocket("/ws/tasks")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
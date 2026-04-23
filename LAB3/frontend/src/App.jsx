import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = "http://localhost:8000/tasks";
const WS_URL = "ws://localhost:8000/ws/tasks";

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const wsRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const fetchTasks = async () => {
    try {
      const response = await axios.get(API_URL);
      setTasks(response.data);
    } catch (error) {
      console.error("Ошибка при получении данных:", error);
    }
  };

  const connectWebSocket = () => {
    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log("✅ WebSocket соединение установлено");
        setConnectionStatus('connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📨 Получено сообщение:", message);

          // Обновить список задач от сервера
          if (message.tasks) {
            setTasks(message.tasks);
          }
        } catch (error) {
          console.error("Ошибка парсинга WebSocket сообщения:", error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ WebSocket ошибка:", error);
        setConnectionStatus('error');
      };

      wsRef.current.onclose = () => {
        console.log("🔌 WebSocket соединение закрыто");
        setConnectionStatus('disconnected');
        // Переподключиться через 3 секунды
        setTimeout(connectWebSocket, 3000);
      };
    } catch (error) {
      console.error("Ошибка при подключении к WebSocket:", error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    fetchTasks();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title) return;
    try {
      await axios.post(API_URL, { title, description: "", completed: false });
      setTitle('');
      // WebSocket автоматически обновит список
    } catch (error) {
      console.error("Ошибка при добавлении:", error);
    }
  };

  const toggleComplete = async (task) => {
    try {
      await axios.put(`${API_URL}/${task.id}`, {
        title: task.title,
        description: task.description,
        completed: !task.completed
      });
      // WebSocket автоматически обновит список
    } catch (error) {
      console.error("Ошибка при обновлении:", error);
    }
  };

  const deleteTask = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      // WebSocket автоматически обновит список
    } catch (error) {
      console.error("Ошибка при удалении:", error);
    }
  };

  // --- НОВОЕ: Функция для отправки Email (SMTP) ---
  const sendEmail = async (task) => {
    const email = prompt("Введите email для отправки задачи:");
    if (!email) return;

    try {
      // Отправляем запрос на бэкенд (который мы доработаем далее)
      await axios.post(`${API_URL}/${task.id}/send-email`, null, {
        params: { email_to: email }
      });
      alert(`Задача "${task.title}" успешно отправлена на ${email}`);
    } catch (error) {
      console.error("Ошибка при отправке почты:", error);
      alert("Не удалось отправить письмо. Проверьте логи бэкенда.");
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#28a745';
      case 'disconnected':
        return '#ff6b6b';
      case 'error':
        return '#ffc107';
      default:
        return '#999';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢 Соединено';
      case 'disconnected':
        return '🔴 Отключено';
      case 'error':
        return '🟡 Ошибка';
      default:
        return '⚪ Неизвестно';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif', color: '#fff', backgroundColor: '#222', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Список задач (Lab 5: WebSocket)</h1>
        <div style={{ padding: '8px 16px', backgroundColor: getStatusColor(), borderRadius: '4px', fontSize: '14px' }}>
          {getStatusText()}
        </div>
      </div>
      
      <form onSubmit={addTask} style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          placeholder="Введите новую задачу..." 
          style={{ padding: '10px', width: '70%', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', marginLeft: '10px', cursor: 'pointer', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px' }}>
          Добавить
        </button>
      </form>

      <table border="1" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#444' }}>
        <thead>
          <tr style={{ backgroundColor: '#333' }}>
            <th style={{ padding: '10px' }}>ID</th>
            <th>Задача (клик для статуса)</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} style={{ borderBottom: '1px solid #444' }}>
              <td style={{ textAlign: 'center', padding: '10px' }}>{task.id}</td>
              <td 
                onClick={() => toggleComplete(task)} 
                style={{ 
                  padding: '10px', 
                  cursor: 'pointer', 
                  textDecoration: task.completed ? 'line-through' : 'none',
                  color: task.completed ? '#888' : '#fff'
                }}
              >
                {task.title}
              </td>
              <td style={{ textAlign: 'center', fontSize: '20px' }}>
                {task.completed ? '✅' : '⏳'}
              </td>
              <td style={{ textAlign: 'center', padding: '10px' }}>
                {/* Кнопка отправки Email */}
                <button 
                  onClick={() => sendEmail(task)} 
                  style={{ marginRight: '8px', color: '#00d4ff', cursor: 'pointer', background: 'none', border: '1px solid #00d4ff', padding: '5px 10px', borderRadius: '4px' }}
                  title="Отправить на почту"
                >
                  📧 Почта
                </button>
                
                <button 
                  onClick={() => deleteTask(task.id)} 
                  style={{ color: '#ff4d4d', cursor: 'pointer', background: 'none', border: '1px solid #ff4d4d', padding: '5px 10px', borderRadius: '4px' }}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <p style={{ textAlign: 'center', marginTop: '20px' }}>Ваш список задач пуст.</p>}
      
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#333', borderRadius: '4px', fontSize: '12px', color: '#aaa' }}>
        <p><strong>WebSocket Status:</strong> {connectionStatus}</p>
        <p><strong>Info:</strong> Все изменения в реальном времени синхронизируются через WebSocket соединение</p>
      </div>
    </div>
  );
}

export default App;
const express = require('express');
const app = express();
app.use(express.json());


app.get('/notify', (req, res) => {
    res.json({ 
        status: "Notifier is running", 
        service: "Service B",
        port: 3002 
    });
});

app.post('/notify', (req, res) => {
    console.log('Получено сообщение от Сервиса А:', req.body.msg);
    res.json({ 
        confirmed: true, 
        message: "Notification received by Service B" 
    });
});


app.put('/notify/config', (req, res) => {
    const { silentMode } = req.body;
    res.json({ 
        message: "Configuration updated", 
        newStatus: silentMode ? "Silent" : "Normal" 
    });
});


app.delete('/notify/logs', (req, res) => {
    console.log('Запрос на очистку логов выполнен');
    res.json({ 
        message: "Logs have been cleared successfully" 
    });
});

app.listen(3002, () => console.log('Notifier Service started on 3002'));
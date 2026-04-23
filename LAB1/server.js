const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.json({
        message: "Docker Lab 1 is running!",
        technology: "Express.js",
        containerized: true,
        date: new Date().toLocaleDateString()
    });
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
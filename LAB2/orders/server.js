const express = require('express');
const axios = require('axios');
const app = express(); 

app.use(express.json());
app.use(express.static('public')); 

let orders = [];

app.get('/orders', (req, res) => {
    res.json(orders);
});


app.post('/orders', async (req, res) => {
    const newOrder = { id: Date.now(), item: req.body.item };
    orders.push(newOrder);

    console.log(`Заказ создан: ${newOrder.item}`);

    try {
        
        const response = await axios.post('http://notifier-service:3002/notify', {
            msg: `Новый заказ на ${newOrder.item}`
        });
        
        res.status(201).json({ 
            status: "Success", 
            order: newOrder, 
            service_b_response: response.data 
        });
    } catch (error) {
        res.status(201).json({ status: "Order saved, but Service B failed", error: error.message });
    }
});


app.put('/orders/:id', (req, res) => {
    const { id } = req.params;
    const { item } = req.body;
    const index = orders.findIndex(o => o.id == id);

    if (index !== -1) {
        orders[index].item = item;
        return res.json({ message: "Order updated", order: orders[index] });
    }
    res.status(404).json({ error: "Order not found" });
});


app.delete('/orders/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = orders.length;
    orders = orders.filter(o => o.id != id);

    if (orders.length < initialLength) {
        return res.json({ message: `Order ${id} deleted` });
    }
    res.status(404).json({ error: "Order not found" });
});

app.listen(3001, () => console.log('Orders Service started on 3001'));
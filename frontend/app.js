const express = require('express');
const amqp = require('amqplib');
const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let messages = []; //temp replace with rabbitmq
let channel = null;
const rabbit = 'amqp://rabbitmq:5672'

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(rabbit);
        channel = await connection.createChannel();
        await channel.assertQueue('messages');
        console.log('Connect to RabbitMQ');
    } catch (err) {
        console.error('RabbitMQ connection failed:', err);
    }
}

connectRabbitMQ();

app.get('/', async (req, res) => {
    res.render('index', { messages });
});

app.post('/submit', async (req, res) => {
    const { text, author } = req.body;
    const message = { text, author, timestamp: new Date().toISOString() };

    if (channel) {
        channel.sendToQueue('messages', Buffer.from(JSON.stringify(message)));
    }

    messages.push(message);
    res.redirect('/');
});

setInterval(async () => {
    try {
        const response = await fetch('http://host.docker.internal:3001/messages');
        messages = await response.json();
    } catch (err) {
        console.log('API fetch failed', err.message, err);
    }
}, 5000);

app.listen(port, () => {
    console.log(`Frontend running at http://localhost:${port}`);
});
const amqp = require('amqplib')
const mysql = require('mysql2/promise');
const express = require('express');
const apiApp = express();

const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';  // rabbitmq service name
const mysqlConfig = {
    host: 'mysql',
    port: 3306,
    user: 'root',
    password: 'rootpass',
    database: 'messages_db'
};

let connection, channel;

async function dbConnect() {
    connection = await mysql.createConnection(mysqlConfig);
    await connection.execute(`CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author VARCHAR(100),
        text VARCHAR(255),
        timestamp DATETIME
    )`);
    console.log('MySQL ready');
    
    // API
    apiApp.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        next();
    });

    apiApp.get('/messages', async (req, res) => {
    const [ rows ] = await connection.execute(`
        SELECT * FROM messages ORDER BY id DESC LIMIT 50
        `);
    res.json(rows);
    });

    apiApp.listen(3001, '0.0.0.0', () => {
        console.log('Backend API: http://localhost:3001/messages');
    });
}

async function rabbitConnect() {
    const conn = await amqp.connect(rabbitUrl);
    channel = await conn.createChannel();
    await channel.assertQueue('messages');
    channel.consume('messages', async (msg) => {
        const data = JSON.parse(msg.content.toString());
        const mysqlTimestamp = new Date(data.timestamp).toISOString().slice(0, 19).replace('T', ' ');

        await connection.execute(
            `INSERT INTO messages (author, text, timestamp) 
            VALUES (?, ?, ?)`,
            [data.author, data.text, mysqlTimestamp]
        );
        channel.ack(msg);
        console.log('Saved:', data.author);
    });
}

dbConnect().then(rabbitConnect);
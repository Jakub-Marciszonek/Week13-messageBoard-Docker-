# General informations

## Requirements
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Run
docker compose up -d

## Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/messages

## Architecture
- Frontend — Express + EJS web UI (port 3000)
- Backend — Express REST API + RabbitMQ consumer (port 3001)
- RabbitMQ — message broker (internal only)
- MySQL — message persistence (internal only)

## Setup & Run

### 1. Clone the repository
    git clone https://github.com/Jakub-Marciszonek/Week13-messageBoard-Docker-.git
    cd Week13-messageBoard-Docker-

### 2. Start the containers
    docker compose -f dokcer-compose.yml up -d

### 3. Verify all containers are ruuning
    docker compose ps

    All four services (mysql, rabbitmq, backend, frontend) should show as running

## Stop the containers
docker compose down # stop, keep database

docker compose down -v # stop and delete database volume

## Logs
docker compose logs -f  # all services
docker compose logs -f backend  # backend only
docker compose logs -f frontend # frontend only

# Frontend:

Message Frontend Service
This is a Node.js frontend service built with Express and EJS. It provides a web UI for submitting messages and displays them by polling the backend API every 5 seconds.

Components
Express + EJS (web server)
Serves an EJS-rendered homepage that displays the current message list. Static assets are served from the public/ directory.
Form submission (POST /submit)
Accepts author and text from an HTML form, constructs a message object with an ISO timestamp, and does two things in parallel:

Publishes it to RabbitMQ so the consumer service can persist it
Pushes it into the local in-memory array immediately for instant UI feedback

RabbitMQ (connectRabbitMQ)
Connects on startup and asserts the messages queue. The channel is stored globally and used when submitting messages. If the connection fails, the app continues running — messages just won't be queued.
Polling interval
Every 5 seconds, the service fetches the latest 50 messages from the backend API and replaces the in-memory array. This keeps the displayed list in sync with what's actually persisted in MySQL.

Routes
Method | Path    | Description 
GET    | /       | Renders the homepage with the current message list
POST   | /submit | Publishes a new message and redirects back to /

Configuration
Variable    | Default                          | Description
port        | 3000                             | Port the frontend listens on
rabbit      | amqp://rabbitmq:5672             | RabbitMQ URL (Docker service name)
Backend API | http://host.docker.internal:3001 | Polling target — uses host.docker.internal to reach the host machine

host.docker.internal is a Docker Desktop-specific hostname.


Expected Form Payload

POST /submit
Content-Type: application/x-www-form-urlencoded

author=Alice&text=Hello+world

Internally this becomes:

json{
  "author": "Alice",
  "text": "Hello world",
  "timestamp": "2026-03-27T10:00:00.000Z"
}

# Backend:
Message Consumer Service
This is a Node.js backend service that bridges RabbitMQ and MySQL — it listens for incoming messages from a queue and persists them to a database, while also exposing a REST API to read them back.

Components
MySQL (dbConnect)
Connects to a MySQL instance and ensures the messages table exists on startup. The table stores four fields: id, author, text, and timestamp.
RabbitMQ (rabbitConnect)
Connects to RabbitMQ and subscribes to the messages queue. Each message is expected to be a JSON payload with author, text, and timestamp fields. On receipt, the message is inserted into MySQL and acknowledged.
REST API (Express on port 3001)
Exposes a single endpoint:
MethodPathDescriptionGET/messagesReturns the 50 most recent messages, newest first
CORS is enabled for all origins (*).

Configuration
Variable        | Default              | Description    
RABBITMQ_URL    | amqp://rabbitmq:5672 | RabbitMQ connection URL
MySQL host      | mysql                | Hostname (Docker service name)
MySQL port      | 3306                 | Standard MySQL port
MySQL user/pass | root/rootpass        | Credentials
MySQL database  | messages_db          | Target database

The defaults are designed for a Docker Compose environment where services are addressed by their service names.


Startup Sequence

Connect to MySQL → create table if missing → start Express API
Connect to RabbitMQ → assert queue → begin consuming

The two steps are chained (dbConnect().then(rabbitConnect)), so the DB is always ready before the consumer starts.

Expected Message Format (RabbitMQ payload)
json{
  "author": "Alice",
  "text": "Hello world",
  "timestamp": "2026-03-27T10:00:00.000Z"
}
The ISO timestamp is converted to MySQL's DATETIME format (YYYY-MM-DD HH:MM:SS) before insertion.
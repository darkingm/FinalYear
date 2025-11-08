import express, { Application } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import chatRoutes from './routes/chat.routes';
import ticketRoutes from './routes/ticket.routes';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { connectRabbitMQ } from './utils/rabbitmq';
import { setupSocketHandlers } from './sockets/chat.socket';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.CHAT_SERVICE_PORT || 3008;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io available to routes
app.set('io', io);

// Routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'chat-service' });
});

app.use('/api/chats', chatRoutes);
app.use('/api/tickets', ticketRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_CHAT || 'chat_db';
    await mongoose.connect(`${mongoUri}/${dbName}`);
    logger.info('MongoDB connected');

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected');

    // Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('RabbitMQ connected');

    httpServer.listen(PORT, () => {
      logger.info(`Chat Service running on port ${PORT}`);
      logger.info(`WebSocket available at ws://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  await mongoose.connection.close();
  await redisClient.disconnect();
  io.close();
  process.exit(0);
});

startServer();

export { io };
export default app;


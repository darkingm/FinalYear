import { Server, Socket } from 'socket.io';
import Message from '../models/Message.model';
import Conversation from '../models/Conversation.model';
import logger from '../utils/logger';

interface UserSocket extends Socket {
  userId?: string;
  username?: string;
}

const onlineUsers = new Map<string, string>(); // userId -> socketId

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: UserSocket) => {
    logger.info('Client connected:', socket.id);

    // User joins (authentication)
    socket.on('user:join', async (data: { userId: string; username: string }) => {
      socket.userId = data.userId;
      socket.username = data.username;
      onlineUsers.set(data.userId, socket.id);

      // Join user's personal room
      socket.join(`user:${data.userId}`);

      // Notify online status
      io.emit('user:online', { userId: data.userId, username: data.username });

      logger.info(`User ${data.username} (${data.userId}) joined`);

      // Send online users list
      const onlineUsersList = Array.from(onlineUsers.keys());
      socket.emit('users:online', onlineUsersList);
    });

    // Join conversation room
    socket.on('conversation:join', async (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.info(`User ${socket.userId} joined conversation ${conversationId}`);

      // Mark messages as read
      if (socket.userId) {
        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: socket.userId },
            readBy: { $ne: socket.userId },
          },
          {
            $addToSet: { readBy: socket.userId },
          }
        );

        // Update unread count
        await Conversation.findByIdAndUpdate(conversationId, {
          [`unreadCount.${socket.userId}`]: 0,
        });

        // Notify participants
        io.to(`conversation:${conversationId}`).emit('messages:read', {
          conversationId,
          userId: socket.userId,
        });
      }
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.info(`User ${socket.userId} left conversation ${conversationId}`);
    });

    // Send message
    socket.on('message:send', async (data: {
      conversationId: string;
      content: string;
      type?: 'TEXT' | 'IMAGE' | 'FILE';
      attachments?: any[];
    }) => {
      try {
        if (!socket.userId || !socket.username) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Create message
        const message = await Message.create({
          conversationId: data.conversationId,
          senderId: socket.userId,
          senderName: socket.username,
          content: data.content,
          type: data.type || 'TEXT',
          attachments: data.attachments || [],
          readBy: [socket.userId],
        });

        // Update conversation
        const conversation = await Conversation.findById(data.conversationId);
        if (conversation) {
          conversation.lastMessageAt = new Date();
          conversation.lastMessage = data.content;

          // Increment unread count for other participants
          conversation.participants.forEach((participantId) => {
            if (participantId !== socket.userId) {
              const currentCount = conversation.unreadCount.get(participantId) || 0;
              conversation.unreadCount.set(participantId, currentCount + 1);
            }
          });

          await conversation.save();
        }

        // Emit to conversation room
        io.to(`conversation:${data.conversationId}`).emit('message:new', {
          message: message.toObject(),
          conversationId: data.conversationId,
        });

        // Notify other participants
        conversation?.participants.forEach((participantId) => {
          if (participantId !== socket.userId) {
            io.to(`user:${participantId}`).emit('conversation:updated', {
              conversationId: data.conversationId,
              lastMessage: data.content,
              unreadCount: conversation.unreadCount.get(participantId),
            });
          }
        });

        logger.info(`Message sent in conversation ${data.conversationId}`);
      } catch (error: any) {
        logger.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user:typing', {
        conversationId: data.conversationId,
        userId: socket.userId,
        username: socket.username,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user:stop-typing', {
        conversationId: data.conversationId,
        userId: socket.userId,
      });
    });

    // Mark message as read
    socket.on('message:read', async (data: { messageId: string; conversationId: string }) => {
      try {
        if (!socket.userId) return;

        await Message.findByIdAndUpdate(data.messageId, {
          $addToSet: { readBy: socket.userId },
        });

        io.to(`conversation:${data.conversationId}`).emit('message:read-update', {
          messageId: data.messageId,
          userId: socket.userId,
        });
      } catch (error: any) {
        logger.error('Mark read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('user:offline', { userId: socket.userId, username: socket.username });
        logger.info(`User ${socket.username} (${socket.userId}) disconnected`);
      } else {
        logger.info('Client disconnected:', socket.id);
      }
    });
  });

  logger.info('Socket.IO handlers configured');
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};


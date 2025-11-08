import { Request, Response } from 'express';
import Conversation from '../models/Conversation.model';
import Message from '../models/Message.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class ChatController {
  // Get user's conversations
  static async getConversations(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { page = 1, limit = 20, type, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const filter: any = {
        participants: userId,
      };

      if (type) filter.type = type;
      if (status) filter.status = status;

      const [conversations, total] = await Promise.all([
        Conversation.find(filter)
          .sort({ lastMessageAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Conversation.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversations',
      });
    }
  }

  // Get conversation by ID
  static async getConversation(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const conversation = await Conversation.findOne({
        _id: id,
        participants: userId,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      logger.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation',
      });
    }
  }

  // Get conversation messages
  static async getMessages(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Check if user is participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [messages, total] = await Promise.all([
        Message.find({
          conversationId,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Message.countDocuments({
          conversationId,
          isDeleted: false,
        }),
      ]);

      res.json({
        success: true,
        data: {
          messages: messages.reverse(), // Oldest first
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages',
      });
    }
  }

  // Create conversation (direct message)
  static async createConversation(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const username = req.headers['x-user-name'] as string || 'User';
      const { participantId, participantName } = req.body;

      // Check if conversation already exists
      const existing = await Conversation.findOne({
        participants: { $all: [userId, participantId] },
        type: 'DIRECT',
      });

      if (existing) {
        return res.json({
          success: true,
          data: existing,
        });
      }

      // Create new conversation
      const conversation = await Conversation.create({
        participants: [userId, participantId],
        participantDetails: [
          { userId, username, role: 'USER' },
          { userId: participantId, username: participantName, role: 'USER' },
        ],
        type: 'DIRECT',
        status: 'ACTIVE',
      });

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      logger.error('Create conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conversation',
        details: error.message,
      });
    }
  }

  // Close conversation
  static async closeConversation(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { id } = req.params;

      const conversation = await Conversation.findOne({
        _id: id,
        participants: userId,
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      conversation.status = 'CLOSED';
      await conversation.save();

      res.json({
        success: true,
        message: 'Conversation closed',
      });
    } catch (error: any) {
      logger.error('Close conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to close conversation',
      });
    }
  }

  // Get unread count
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;

      const conversations = await Conversation.find({
        participants: userId,
        status: 'ACTIVE',
      });

      let totalUnread = 0;
      conversations.forEach((conv) => {
        const unread = conv.unreadCount.get(userId) || 0;
        totalUnread += unread;
      });

      res.json({
        success: true,
        data: {
          totalUnread,
          conversations: conversations.map((conv) => ({
            conversationId: conv.id,
            unreadCount: conv.unreadCount.get(userId) || 0,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch unread count',
      });
    }
  }
}


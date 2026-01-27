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
      const userRole = (req.headers['x-user-role'] as string) || 'USER';
      const { participantId, participantName, participantRole, productId, productTitle } = req.body;

      // Check if conversation already exists
      const query: any = {
        participants: { $all: [userId, participantId] },
      };
      
      // If product inquiry, also check productId
      if (productId) {
        query.type = 'PRODUCT_INQUIRY';
        query.productId = productId;
      } else {
        query.type = 'DIRECT';
      }

      const existing = await Conversation.findOne(query);

      if (existing) {
        return res.json({
          success: true,
          data: existing,
        });
      }

      // Determine participant roles
      const otherRole = participantRole || 'USER';

      // Create new conversation
      const conversation = await Conversation.create({
        participants: [userId, participantId],
        participantDetails: [
          { userId, username, role: userRole as 'USER' | 'SELLER' | 'SUPPORT' | 'ADMIN' },
          { userId: participantId, username: participantName, role: otherRole as 'USER' | 'SELLER' | 'SUPPORT' | 'ADMIN' },
        ],
        type: productId ? 'PRODUCT_INQUIRY' : 'DIRECT',
        status: 'ACTIVE',
        productId: productId || undefined,
        productTitle: productTitle || undefined,
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

  // Create conversation with seller about product
  static async createProductInquiry(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const username = req.headers['x-user-name'] as string || 'User';
      const { productId, sellerId, sellerName, productTitle } = req.body;

      if (!productId || !sellerId) {
        return res.status(400).json({
          success: false,
          error: 'Product ID and Seller ID are required',
        });
      }

      // Check if conversation already exists for this product
      const existing = await Conversation.findOne({
        participants: { $all: [userId, sellerId] },
        type: 'PRODUCT_INQUIRY',
        productId,
        status: 'ACTIVE',
      });

      if (existing) {
        return res.json({
          success: true,
          data: existing,
        });
      }

      // Create new product inquiry conversation
      const conversation = await Conversation.create({
        participants: [userId, sellerId],
        participantDetails: [
          { userId, username, role: 'USER' },
          { userId: sellerId, username: sellerName || 'Seller', role: 'SELLER' },
        ],
        type: 'PRODUCT_INQUIRY',
        status: 'ACTIVE',
        productId,
        productTitle: productTitle || 'Product Inquiry',
      });

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      logger.error('Create product inquiry error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create product inquiry',
        details: error.message,
      });
    }
  }

  // Get conversations by seller (for seller dashboard)
  static async getSellerConversations(req: Request, res: Response) {
    try {
      const sellerId = req.headers['x-user-id'] as string;
      const userRole = (req.headers['x-user-role'] as string) || 'USER';
      
      // Only sellers can access this
      if (userRole !== 'SELLER' && userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Only sellers can access this endpoint',
        });
      }

      const { page = 1, limit = 20, status, type } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const filter: any = {
        participants: sellerId,
        'participantDetails.role': 'SELLER',
      };

      if (status) filter.status = status;
      if (type) filter.type = type;

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
      logger.error('Get seller conversations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch seller conversations',
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


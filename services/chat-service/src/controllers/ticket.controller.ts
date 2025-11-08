import { Request, Response } from 'express';
import Ticket from '../models/Ticket.model';
import Conversation from '../models/Conversation.model';
import Message from '../models/Message.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class TicketController {
  // Create support ticket
  static async createTicket(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const username = req.headers['x-user-name'] as string || 'User';
      
      const { subject, description, category, priority } = req.body;

      // Create ticket
      const ticket = await Ticket.create({
        userId,
        username,
        subject,
        description,
        category: category || 'OTHER',
        priority: priority || 'MEDIUM',
        status: 'OPEN',
      });

      // Create conversation for this ticket
      const conversation = await Conversation.create({
        participants: [userId], // Support will be added when assigned
        participantDetails: [
          { userId, username, role: 'USER' },
        ],
        type: 'SUPPORT',
        status: 'ACTIVE',
      });

      // Link ticket to conversation
      ticket.conversationId = conversation.id;
      await ticket.save();

      // Create initial system message
      await Message.create({
        conversationId: conversation.id,
        senderId: 'system',
        senderName: 'System',
        content: `Support ticket created: ${subject}`,
        type: 'SYSTEM',
        attachments: [],
        readBy: [userId],
      });

      // Publish event
      await publishEvent('ticket.created', {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        userId,
        subject,
        category,
        priority,
      });

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Create ticket error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create ticket',
        details: error.message,
      });
    }
  }

  // Get user's tickets
  static async getUserTickets(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { page = 1, limit = 20, status } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const filter: any = { userId };
      if (status) filter.status = status;

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Ticket.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          tickets,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get user tickets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tickets',
      });
    }
  }

  // Get ticket by ID
  static async getTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Get ticket error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket',
      });
    }
  }

  // Admin: Get all tickets
  static async getAllTickets(req: Request, res: Response) {
    try {
      const { page = 1, limit = 50, status, priority, category } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const filter: any = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (category) filter.category = category;

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Ticket.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          tickets,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get all tickets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tickets',
      });
    }
  }

  // Admin: Assign ticket
  static async assignTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { assignedTo, assignedToName } = req.body;
      const adminId = req.headers['x-user-id'] as string;

      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      ticket.assignedTo = assignedTo;
      ticket.assignedToName = assignedToName;
      ticket.status = 'IN_PROGRESS';
      await ticket.save();

      // Add support to conversation
      if (ticket.conversationId) {
        const conversation = await Conversation.findById(ticket.conversationId);
        if (conversation) {
          if (!conversation.participants.includes(assignedTo)) {
            conversation.participants.push(assignedTo);
            conversation.participantDetails.push({
              userId: assignedTo,
              username: assignedToName,
              role: 'SUPPORT',
            });
            await conversation.save();
          }

          // Send system message
          await Message.create({
            conversationId: ticket.conversationId,
            senderId: 'system',
            senderName: 'System',
            content: `Ticket assigned to ${assignedToName}`,
            type: 'SYSTEM',
            attachments: [],
            readBy: [assignedTo],
          });
        }
      }

      // Publish event
      await publishEvent('ticket.assigned', {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        assignedTo,
        assignedBy: adminId,
      });

      res.json({
        success: true,
        message: 'Ticket assigned successfully',
      });
    } catch (error: any) {
      logger.error('Assign ticket error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign ticket',
      });
    }
  }

  // Admin: Update ticket status
  static async updateTicketStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const ticket = await Ticket.findById(id);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
        });
      }

      ticket.status = status;

      if (status === 'RESOLVED') {
        ticket.resolvedAt = new Date();
      } else if (status === 'CLOSED') {
        ticket.closedAt = new Date();
        
        // Close conversation
        if (ticket.conversationId) {
          await Conversation.findByIdAndUpdate(ticket.conversationId, {
            status: 'CLOSED',
          });
        }
      }

      await ticket.save();

      // Send system message
      if (ticket.conversationId) {
        await Message.create({
          conversationId: ticket.conversationId,
          senderId: 'system',
          senderName: 'System',
          content: `Ticket status updated to ${status}`,
          type: 'SYSTEM',
          attachments: [],
          readBy: [],
        });
      }

      res.json({
        success: true,
        message: 'Ticket status updated',
      });
    } catch (error: any) {
      logger.error('Update ticket status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update ticket status',
      });
    }
  }

  // Get ticket statistics
  static async getTicketStats(req: Request, res: Response) {
    try {
      const [totalTickets, openTickets, inProgressTickets, resolvedTickets, closedTickets] =
        await Promise.all([
          Ticket.countDocuments(),
          Ticket.countDocuments({ status: 'OPEN' }),
          Ticket.countDocuments({ status: 'IN_PROGRESS' }),
          Ticket.countDocuments({ status: 'RESOLVED' }),
          Ticket.countDocuments({ status: 'CLOSED' }),
        ]);

      res.json({
        success: true,
        data: {
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
        },
      });
    } catch (error: any) {
      logger.error('Get ticket stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
      });
    }
  }
}


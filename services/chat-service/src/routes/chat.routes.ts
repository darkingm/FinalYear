import express from 'express';
import { body } from 'express-validator';
import { ChatController } from '../controllers/chat.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// All routes require authentication (checked by API Gateway)

// Get conversations
router.get('/', ChatController.getConversations);

// Get specific conversation
router.get('/:id', ChatController.getConversation);

// Get conversation messages
router.get('/:conversationId/messages', ChatController.getMessages);

// Create conversation (direct message)
router.post(
  '/',
  [
    body('participantId').notEmpty().withMessage('Participant ID is required'),
    body('participantName').notEmpty().withMessage('Participant name is required'),
    validate,
  ],
  ChatController.createConversation
);

// Close conversation
router.post('/:id/close', ChatController.closeConversation);

// Get unread count
router.get('/unread/count', ChatController.getUnreadCount);

export default router;


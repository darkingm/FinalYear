import express from 'express';
import { body } from 'express-validator';
import { TicketController } from '../controllers/ticket.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// User routes (require authentication)
router.post(
  '/',
  [
    body('subject').trim().isLength({ min: 5, max: 200 }).withMessage('Subject must be 5-200 characters'),
    body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
    body('category').optional().isIn(['TECHNICAL', 'BILLING', 'PRODUCT', 'ACCOUNT', 'OTHER']).withMessage('Invalid category'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority'),
    validate,
  ],
  TicketController.createTicket
);

router.get('/', TicketController.getUserTickets);
router.get('/:id', TicketController.getTicket);

// Admin routes (require admin/support role)
router.get('/admin/all', TicketController.getAllTickets);
router.get('/admin/stats', TicketController.getTicketStats);

router.post(
  '/admin/:id/assign',
  [
    body('assignedTo').notEmpty().withMessage('Assigned to is required'),
    body('assignedToName').notEmpty().withMessage('Assigned to name is required'),
    validate,
  ],
  TicketController.assignTicket
);

router.put(
  '/admin/:id/status',
  [
    body('status').isIn(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).withMessage('Invalid status'),
    validate,
  ],
  TicketController.updateTicketStatus
);

export default router;


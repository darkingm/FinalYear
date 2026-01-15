import express from 'express';
import { body } from 'express-validator';
import { CommentController } from '../controllers/comment.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Get post comments (public)
router.get('/post/:postId', CommentController.getPostComments);

// Protected routes (require authentication)
router.post(
  '/',
  [
    body('postId').notEmpty().withMessage('Post ID is required'),
    body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Content must be 1-1000 characters'),
    body('parentCommentId').optional().isString(),
    validate,
  ],
  CommentController.createComment
);

router.put(
  '/:id',
  [
    body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Content must be 1-1000 characters'),
    validate,
  ],
  CommentController.updateComment
);

router.delete('/:id', CommentController.deleteComment);
router.post('/:id/like', CommentController.toggleLike);

export default router;


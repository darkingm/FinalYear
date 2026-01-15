import express from 'express';
import { body, query } from 'express-validator';
import { PostController } from '../controllers/post.controller';
import { validate } from '../middleware/validate.middleware';

const router = express.Router();

// Public routes
router.get('/feed', PostController.getFeed);
router.get('/search', PostController.searchPosts);
router.get('/user/:userId', PostController.getUserPosts);
router.get('/:id', PostController.getPostById);

// Protected routes (require authentication)
router.post(
  '/',
  [
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
    body('images').optional().isArray().withMessage('Images must be an array'),
    body('visibility').optional().isIn(['PUBLIC', 'FRIENDS', 'PRIVATE']).withMessage('Invalid visibility'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    validate,
  ],
  PostController.createPost
);

router.put(
  '/:id',
  [
    body('content').optional().trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
    body('images').optional().isArray(),
    body('visibility').optional().isIn(['PUBLIC', 'FRIENDS', 'PRIVATE']),
    body('tags').optional().isArray(),
    validate,
  ],
  PostController.updatePost
);

router.delete('/:id', PostController.deletePost);
router.post('/:id/like', PostController.toggleLike);
router.post('/:id/share', PostController.sharePost);

export default router;


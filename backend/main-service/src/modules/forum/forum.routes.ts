import { Router } from 'express';
import {
  listPosts,
  getPost,
  createPost,
  deletePost,
  createComment,
  deleteComment,
} from './forum.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// ─── Public reads ────────────────────────────────────────────────────────
router.get('/posts', listPosts);
router.get('/posts/:id', getPost);

// ─── Authenticated writes ────────────────────────────────────────────────
router.post('/posts', authenticate, createPost);
router.delete('/posts/:id', authenticate, deletePost);
router.post('/posts/:id/comments', authenticate, createComment);
router.delete('/comments/:id', authenticate, deleteComment);

export { router as forumRouter };

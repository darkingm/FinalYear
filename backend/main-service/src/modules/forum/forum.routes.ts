import { Router } from 'express';
import {
  listPosts,
  getPost,
  createPost,
  editPost,
  deletePost,
  createComment,
  editComment,
  deleteComment,
  togglePostLike,
  toggleCommentLike,
} from './forum.controller';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware';

const router = Router();

// ─── Public reads (with optionalAuth so liked_by_me is populated) ────────
router.get('/posts',     optionalAuth, listPosts);
router.get('/posts/:id', optionalAuth, getPost);

// ─── Authenticated writes ────────────────────────────────────────────────
router.post('/posts',                 authenticate, createPost);
router.patch('/posts/:id',            authenticate, editPost);
router.delete('/posts/:id',           authenticate, deletePost);
router.post('/posts/:id/comments',    authenticate, createComment);
router.patch('/comments/:id',         authenticate, editComment);
router.delete('/comments/:id',        authenticate, deleteComment);

// ─── Likes (idempotent toggle) ───────────────────────────────────────────
router.post('/posts/:id/like',     authenticate, togglePostLike);
router.post('/comments/:id/like',  authenticate, toggleCommentLike);

export { router as forumRouter };

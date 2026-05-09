import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { query } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';

/**
 * Forum module — flat threads + 1-level comment replies.
 *
 * Design notes
 * ─────────────
 * - We surface a non-deleted view by default (`is_deleted = FALSE`). Hard
 *   delete is reserved for admin moderation if it's ever needed; soft delete
 *   keeps reply trees from collapsing into orphans.
 * - The `comment_count` denormalised counter on forum_posts is the cheap path
 *   for the post list. We bump it on insert and decrement on soft-delete.
 *   A periodic recount job is fine for drift; for a demo a small denorm is
 *   acceptable.
 * - Authors and admins can delete their own content. Non-authors get 403.
 * - Token tag (`token_pair`) lets the frontend filter posts by the chart the
 *   user is currently looking at, e.g. `/api/forum/posts?token_pair=0xabc...`.
 */

const sanitize = (raw: unknown, max: number, min: number = 1): string => {
  if (typeof raw !== 'string') throw new AppError('field is required (string)', 400);
  const trimmed = raw.trim();
  if (trimmed.length < min) throw new AppError(`field is too short (min ${min})`, 400);
  if (trimmed.length > max) throw new AppError(`field is too long (max ${max})`, 400);
  return trimmed;
};

// ─── List posts (paginated, optionally filtered by token_pair) ───────────
export async function listPosts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const tokenPair = typeof req.query.token_pair === 'string' ? req.query.token_pair.toLowerCase() : null;

    const where: string[] = ['p.is_deleted = FALSE'];
    const params: any[] = [];
    if (tokenPair) {
      params.push(tokenPair);
      where.push(`LOWER(p.token_pair) = $${params.length}`);
    }

    params.push(limit, offset);
    const result = await query(
      `SELECT p.post_id, p.title, p.body, p.token_pair, p.comment_count,
              p.created_at, p.updated_at,
              u.user_id AS author_id, u.username AS author_name, u.avatar_url AS author_avatar
       FROM forum_posts p
       JOIN users u ON p.author_id = u.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, -2);
    const countRes = await query(
      `SELECT COUNT(*) AS total FROM forum_posts p WHERE ${where.join(' AND ')}`,
      countParams
    );

    res.json({
      success: true,
      posts: result.rows,
      pagination: { limit, offset, total: parseInt(countRes.rows[0].total) },
    });
  } catch (err) { next(err); }
}

// ─── Get one post + its comments ─────────────────────────────────────────
export async function getPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = parseInt(req.params.id);
    if (!postId) throw new AppError('Invalid post id', 400);

    const postRes = await query(
      `SELECT p.post_id, p.title, p.body, p.token_pair, p.comment_count,
              p.created_at, p.updated_at,
              u.user_id AS author_id, u.username AS author_name, u.avatar_url AS author_avatar
       FROM forum_posts p
       JOIN users u ON p.author_id = u.user_id
       WHERE p.post_id = $1 AND p.is_deleted = FALSE`,
      [postId]
    );
    if (postRes.rows.length === 0) throw new AppError('Post not found', 404);

    const commentsRes = await query(
      `SELECT c.comment_id, c.parent_comment_id, c.body, c.created_at, c.updated_at,
              u.user_id AS author_id, u.username AS author_name, u.avatar_url AS author_avatar
       FROM forum_comments c
       JOIN users u ON c.author_id = u.user_id
       WHERE c.post_id = $1 AND c.is_deleted = FALSE
       ORDER BY c.created_at ASC`,
      [postId]
    );

    res.json({ success: true, post: postRes.rows[0], comments: commentsRes.rows });
  } catch (err) { next(err); }
}

// ─── Create a new post ───────────────────────────────────────────────────
export async function createPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.user_id;
    const title = sanitize(req.body?.title, 200, 3);
    const body = sanitize(req.body?.body, 8000, 1);
    const tokenPair = typeof req.body?.token_pair === 'string' && req.body.token_pair.trim()
      ? req.body.token_pair.trim().toLowerCase().slice(0, 64)
      : null;

    const result = await query(
      `INSERT INTO forum_posts (author_id, title, body, token_pair)
       VALUES ($1, $2, $3, $4)
       RETURNING post_id, title, body, token_pair, comment_count, created_at, updated_at`,
      [userId, title, body, tokenPair]
    );

    logger.info('forum:create-post', { userId, postId: result.rows[0].post_id });
    res.status(201).json({ success: true, post: result.rows[0] });
  } catch (err) { next(err); }
}

// ─── Soft-delete a post (author or admin) ────────────────────────────────
export async function deletePost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = parseInt(req.params.id);
    if (!postId) throw new AppError('Invalid post id', 400);
    const userId = req.user!.user_id;
    const isAdmin = req.user!.role === 'admin';

    const result = await query(
      `UPDATE forum_posts SET is_deleted = TRUE, updated_at = NOW()
        WHERE post_id = $1 AND is_deleted = FALSE
          AND ($2 = TRUE OR author_id = $3)
       RETURNING post_id`,
      [postId, isAdmin, userId]
    );
    if (result.rows.length === 0) {
      // Either it doesn't exist, was already deleted, or user isn't allowed.
      const exists = await query('SELECT author_id FROM forum_posts WHERE post_id = $1', [postId]);
      if (exists.rows.length === 0) throw new AppError('Post not found', 404);
      throw new AppError('You are not allowed to delete this post', 403);
    }

    logger.info('forum:delete-post', { userId, postId, isAdmin });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── Add a comment / reply ───────────────────────────────────────────────
export async function createComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = parseInt(req.params.id);
    if (!postId) throw new AppError('Invalid post id', 400);
    const userId = req.user!.user_id;
    const body = sanitize(req.body?.body, 4000, 1);
    const parentCommentId = req.body?.parent_comment_id ? parseInt(req.body.parent_comment_id) : null;

    // Ensure post exists and is live
    const postCheck = await query(
      'SELECT post_id FROM forum_posts WHERE post_id = $1 AND is_deleted = FALSE',
      [postId]
    );
    if (postCheck.rows.length === 0) throw new AppError('Post not found', 404);

    // If replying to a comment, ensure it belongs to this post
    if (parentCommentId) {
      const parent = await query(
        'SELECT post_id FROM forum_comments WHERE comment_id = $1 AND is_deleted = FALSE',
        [parentCommentId]
      );
      if (parent.rows.length === 0) throw new AppError('Parent comment not found', 404);
      if (parent.rows[0].post_id !== postId) {
        throw new AppError('Parent comment belongs to a different post', 400);
      }
    }

    const result = await query(
      `INSERT INTO forum_comments (post_id, author_id, parent_comment_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING comment_id, post_id, parent_comment_id, body, created_at, updated_at`,
      [postId, userId, parentCommentId, body]
    );

    // Bump denorm counter on the post
    await query(
      'UPDATE forum_posts SET comment_count = comment_count + 1, updated_at = NOW() WHERE post_id = $1',
      [postId]
    );

    logger.info('forum:create-comment', { userId, postId, commentId: result.rows[0].comment_id, parentCommentId });
    res.status(201).json({ success: true, comment: result.rows[0] });
  } catch (err) { next(err); }
}

// ─── Soft-delete a comment (author or admin) ─────────────────────────────
export async function deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const commentId = parseInt(req.params.id);
    if (!commentId) throw new AppError('Invalid comment id', 400);
    const userId = req.user!.user_id;
    const isAdmin = req.user!.role === 'admin';

    const result = await query(
      `UPDATE forum_comments SET is_deleted = TRUE, updated_at = NOW()
        WHERE comment_id = $1 AND is_deleted = FALSE
          AND ($2 = TRUE OR author_id = $3)
       RETURNING comment_id, post_id`,
      [commentId, isAdmin, userId]
    );
    if (result.rows.length === 0) {
      const exists = await query('SELECT author_id FROM forum_comments WHERE comment_id = $1', [commentId]);
      if (exists.rows.length === 0) throw new AppError('Comment not found', 404);
      throw new AppError('You are not allowed to delete this comment', 403);
    }

    // Decrement denorm counter
    await query(
      'UPDATE forum_posts SET comment_count = GREATEST(comment_count - 1, 0), updated_at = NOW() WHERE post_id = $1',
      [result.rows[0].post_id]
    );

    logger.info('forum:delete-comment', { userId, commentId, isAdmin });
    res.json({ success: true });
  } catch (err) { next(err); }
}

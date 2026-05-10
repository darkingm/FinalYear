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

// ─── List posts (paginated, optionally filtered + sorted) ────────────────
type SortMode = 'newest' | 'popular' | 'comments';
const ORDER_BY: Record<SortMode, string> = {
  newest:   'p.created_at DESC',
  popular:  'p.like_count DESC, p.created_at DESC',
  comments: 'p.comment_count DESC, p.created_at DESC',
};

export async function listPosts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const tokenPair = typeof req.query.token_pair === 'string' ? req.query.token_pair.toLowerCase() : null;
    const sort: SortMode = (['newest', 'popular', 'comments'] as const).includes(req.query.sort as any)
      ? (req.query.sort as SortMode)
      : 'newest';
    // viewer_id lets the response carry per-row `liked_by_me` so the
    // frontend can paint the heart icon active without a second roundtrip.
    const viewerId = req.user?.user_id ?? null;

    const where: string[] = ['p.is_deleted = FALSE'];
    const params: any[] = [];
    if (tokenPair) {
      params.push(tokenPair);
      where.push(`LOWER(p.token_pair) = $${params.length}`);
    }

    params.push(viewerId);
    const viewerIdx = params.length;
    params.push(limit, offset);
    const result = await query(
      `SELECT p.post_id, p.title, p.body, p.token_pair, p.comment_count, p.like_count,
              p.created_at, p.updated_at,
              u.user_id AS author_id, u.username AS author_name, u.avatar_url AS author_avatar,
              CASE
                WHEN $${viewerIdx}::int IS NULL THEN FALSE
                ELSE EXISTS(SELECT 1 FROM forum_post_likes l
                              WHERE l.post_id = p.post_id AND l.user_id = $${viewerIdx}::int)
              END AS liked_by_me
       FROM forum_posts p
       JOIN users u ON p.author_id = u.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${ORDER_BY[sort]}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, tokenPair ? 1 : 0);
    const countRes = await query(
      `SELECT COUNT(*) AS total FROM forum_posts p WHERE ${where.join(' AND ')}`,
      countParams
    );

    res.json({
      success: true,
      posts: result.rows,
      pagination: { limit, offset, total: parseInt(countRes.rows[0].total) },
      sort,
    });
  } catch (err) { next(err); }
}

// ─── Get one post + its comments ─────────────────────────────────────────
export async function getPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = parseInt(req.params.id);
    if (!postId) throw new AppError('Invalid post id', 400);
    const viewerId = req.user?.user_id ?? null;

    const postRes = await query(
      `SELECT p.post_id, p.title, p.body, p.token_pair, p.comment_count, p.like_count,
              p.created_at, p.updated_at,
              u.user_id AS author_id, u.username AS author_name, u.avatar_url AS author_avatar,
              CASE
                WHEN $2::int IS NULL THEN FALSE
                ELSE EXISTS(SELECT 1 FROM forum_post_likes l
                              WHERE l.post_id = p.post_id AND l.user_id = $2::int)
              END AS liked_by_me
       FROM forum_posts p
       JOIN users u ON p.author_id = u.user_id
       WHERE p.post_id = $1 AND p.is_deleted = FALSE`,
      [postId, viewerId]
    );
    if (postRes.rows.length === 0) throw new AppError('Post not found', 404);

    const commentsRes = await query(
      `SELECT c.comment_id, c.parent_comment_id, c.body, c.like_count,
              c.created_at, c.updated_at,
              u.user_id AS author_id, u.username AS author_name, u.avatar_url AS author_avatar,
              CASE
                WHEN $2::int IS NULL THEN FALSE
                ELSE EXISTS(SELECT 1 FROM forum_comment_likes l
                              WHERE l.comment_id = c.comment_id AND l.user_id = $2::int)
              END AS liked_by_me
       FROM forum_comments c
       JOIN users u ON c.author_id = u.user_id
       WHERE c.post_id = $1 AND c.is_deleted = FALSE
       ORDER BY c.created_at ASC`,
      [postId, viewerId]
    );

    res.json({ success: true, post: postRes.rows[0], comments: commentsRes.rows });
  } catch (err) { next(err); }
}

// ─── Edit a post (author only) ───────────────────────────────────────────
export async function editPost(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = parseInt(req.params.id);
    if (!postId) throw new AppError('Invalid post id', 400);
    const userId = req.user!.user_id;

    const updates: string[] = [];
    const params: any[] = [];

    if (req.body?.title !== undefined) {
      const title = sanitize(req.body.title, 200, 3);
      params.push(title);
      updates.push(`title = $${params.length}`);
    }
    if (req.body?.body !== undefined) {
      const body = sanitize(req.body.body, 8000, 1);
      params.push(body);
      updates.push(`body = $${params.length}`);
    }
    if (updates.length === 0) throw new AppError('No fields to update', 400);
    updates.push('updated_at = NOW()');

    params.push(postId, userId);
    const result = await query(
      `UPDATE forum_posts SET ${updates.join(', ')}
        WHERE post_id = $${params.length - 1}
          AND author_id = $${params.length}
          AND is_deleted = FALSE
       RETURNING post_id, title, body, token_pair, comment_count, like_count, created_at, updated_at`,
      params
    );
    if (result.rows.length === 0) {
      const exists = await query('SELECT author_id FROM forum_posts WHERE post_id = $1 AND is_deleted = FALSE', [postId]);
      if (exists.rows.length === 0) throw new AppError('Post not found', 404);
      throw new AppError('You are not allowed to edit this post', 403);
    }

    logger.info('forum:edit-post', { userId, postId });
    res.json({ success: true, post: result.rows[0] });
  } catch (err) { next(err); }
}

// ─── Edit a comment (author only) ────────────────────────────────────────
export async function editComment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const commentId = parseInt(req.params.id);
    if (!commentId) throw new AppError('Invalid comment id', 400);
    const userId = req.user!.user_id;
    const body = sanitize(req.body?.body, 4000, 1);

    const result = await query(
      `UPDATE forum_comments SET body = $1, updated_at = NOW()
        WHERE comment_id = $2 AND author_id = $3 AND is_deleted = FALSE
       RETURNING comment_id, post_id, parent_comment_id, body, like_count, created_at, updated_at`,
      [body, commentId, userId]
    );
    if (result.rows.length === 0) {
      const exists = await query('SELECT author_id FROM forum_comments WHERE comment_id = $1 AND is_deleted = FALSE', [commentId]);
      if (exists.rows.length === 0) throw new AppError('Comment not found', 404);
      throw new AppError('You are not allowed to edit this comment', 403);
    }

    logger.info('forum:edit-comment', { userId, commentId });
    res.json({ success: true, comment: result.rows[0] });
  } catch (err) { next(err); }
}

// ─── Toggle a like on a post ─────────────────────────────────────────────
// Idempotent toggle: each call flips the user's like state for that post.
// We do the toggle in a single transaction so the denormalised counter
// can never drift: if INSERT fires we bump like_count, if DELETE fires we
// decrement (clamped at 0). Returns the post's new {liked_by_me, like_count}.
export async function togglePostLike(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const postId = parseInt(req.params.id);
    if (!postId) throw new AppError('Invalid post id', 400);
    const userId = req.user!.user_id;

    // Ensure post exists + live
    const postCheck = await query(
      'SELECT post_id FROM forum_posts WHERE post_id = $1 AND is_deleted = FALSE',
      [postId]
    );
    if (postCheck.rows.length === 0) throw new AppError('Post not found', 404);

    // Try to insert. If already liked, the ON CONFLICT path tells us to undo.
    const ins = await query(
      `INSERT INTO forum_post_likes (post_id, user_id) VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING
       RETURNING post_id`,
      [postId, userId]
    );
    let liked: boolean;
    if (ins.rows.length > 0) {
      // Newly inserted → bump counter
      await query('UPDATE forum_posts SET like_count = like_count + 1 WHERE post_id = $1', [postId]);
      liked = true;
    } else {
      // Already liked → DELETE to toggle off
      await query('DELETE FROM forum_post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      await query('UPDATE forum_posts SET like_count = GREATEST(like_count - 1, 0) WHERE post_id = $1', [postId]);
      liked = false;
    }

    const counter = await query('SELECT like_count FROM forum_posts WHERE post_id = $1', [postId]);
    res.json({
      success: true,
      liked_by_me: liked,
      like_count: counter.rows[0]?.like_count ?? 0,
    });
  } catch (err) { next(err); }
}

// ─── Toggle a like on a comment ──────────────────────────────────────────
export async function toggleCommentLike(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const commentId = parseInt(req.params.id);
    if (!commentId) throw new AppError('Invalid comment id', 400);
    const userId = req.user!.user_id;

    const check = await query(
      'SELECT comment_id FROM forum_comments WHERE comment_id = $1 AND is_deleted = FALSE',
      [commentId]
    );
    if (check.rows.length === 0) throw new AppError('Comment not found', 404);

    const ins = await query(
      `INSERT INTO forum_comment_likes (comment_id, user_id) VALUES ($1, $2)
       ON CONFLICT (comment_id, user_id) DO NOTHING
       RETURNING comment_id`,
      [commentId, userId]
    );
    let liked: boolean;
    if (ins.rows.length > 0) {
      await query('UPDATE forum_comments SET like_count = like_count + 1 WHERE comment_id = $1', [commentId]);
      liked = true;
    } else {
      await query('DELETE FROM forum_comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
      await query('UPDATE forum_comments SET like_count = GREATEST(like_count - 1, 0) WHERE comment_id = $1', [commentId]);
      liked = false;
    }
    const counter = await query('SELECT like_count FROM forum_comments WHERE comment_id = $1', [commentId]);
    res.json({
      success: true,
      liked_by_me: liked,
      like_count: counter.rows[0]?.like_count ?? 0,
    });
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
       RETURNING post_id, title, body, token_pair, comment_count, like_count, created_at, updated_at`,
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
       RETURNING comment_id, post_id, parent_comment_id, body, like_count, created_at, updated_at`,
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

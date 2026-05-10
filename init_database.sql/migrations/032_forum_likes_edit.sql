-- Migration 032 — Forum: likes + edit tracking + sort denorms.
--
-- Adds per-user reactions on posts and comments. The composite PK on
-- (post_id, user_id) and (comment_id, user_id) means each user can like
-- a target at most once; toggling is INSERT … ON CONFLICT DO DELETE on
-- the application side.
--
-- like_count is denormalised on the parent rows so the post list query
-- can sort by popularity without a join — same pattern as comment_count.

CREATE TABLE IF NOT EXISTS forum_post_likes (
  post_id    INTEGER NOT NULL REFERENCES forum_posts(post_id)    ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id)          ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user ON forum_post_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_comment_likes (
  comment_id INTEGER NOT NULL REFERENCES forum_comments(comment_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id)             ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_forum_comment_likes_user ON forum_comment_likes (user_id, created_at DESC);

ALTER TABLE forum_posts    ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- Helps the new sort=popular branch on /api/forum/posts.
CREATE INDEX IF NOT EXISTS idx_forum_posts_likes  ON forum_posts (like_count DESC, created_at DESC) WHERE is_deleted = FALSE;

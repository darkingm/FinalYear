-- Migration 031 — Forum (posts + comments) for the on-chain tab.
-- Posts are flat threads; comments are 1-level deep. Reply-to-comment is
-- modelled as parent_comment_id self-FK so a future UI can render trees
-- without another schema migration.

CREATE TABLE IF NOT EXISTS forum_posts (
  post_id      SERIAL PRIMARY KEY,
  author_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  -- Optional token tag — when a user opens this post from a token's chart,
  -- /forum?pair=0xabc filters by this column. NULL = general discussion.
  token_pair   VARCHAR(64),
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_posts_title_len  CHECK (char_length(title) BETWEEN 3 AND 200),
  CONSTRAINT forum_posts_body_len   CHECK (char_length(body) BETWEEN 1 AND 8000)
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_created    ON forum_posts (created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_forum_posts_author     ON forum_posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_token_pair ON forum_posts (token_pair, created_at DESC) WHERE token_pair IS NOT NULL AND is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS forum_comments (
  comment_id        SERIAL PRIMARY KEY,
  post_id           INTEGER NOT NULL REFERENCES forum_posts(post_id) ON DELETE CASCADE,
  author_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  parent_comment_id INTEGER REFERENCES forum_comments(comment_id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_comments_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_post   ON forum_comments (post_id, created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent ON forum_comments (parent_comment_id) WHERE parent_comment_id IS NOT NULL;

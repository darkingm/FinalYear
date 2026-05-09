'use client';

/**
 * ForumPanel — discussion board embedded in the on-chain tracker's left
 * sidebar. Users can post, comment, reply (1-level), and delete their own
 * content. Optionally filtered by `tokenPair` so each token has its own
 * thread namespace.
 *
 * The component is intentionally self-contained: it owns the post list,
 * the post-detail view, and the create/reply forms. Switching to a token
 * in the parent flips the `tokenPair` prop and re-fetches.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft, MessageSquare, Plus, Send, Trash2, Loader2, RefreshCw, X, Hash,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';
import { parseHashtags, extractHashtagSymbols } from '@/lib/forum/hashtags';

interface ForumPostSummary {
  post_id: number;
  title: string;
  body: string;
  token_pair: string | null;
  comment_count: number;
  created_at: string;
  updated_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
}

interface ForumComment {
  comment_id: number;
  parent_comment_id: number | null;
  body: string;
  created_at: string;
  updated_at: string;
  author_id: number;
  author_name: string;
  author_avatar: string | null;
}

interface Props {
  /** Optional filter: only show posts tagged with this token pair address. */
  tokenPair?: string | null;
  /** Display label for the token (used in the empty-state CTA). */
  tokenLabel?: string;
  /**
   * Called when the user clicks a $SYMBOL hashtag in a post or comment.
   * The page handler is responsible for searching the symbol → top pair
   * → setting it as the active pair (which will load chart + token info).
   */
  onSymbolClick?: (symbol: string) => void;
}

/**
 * Renders text with `$BTC` / `#ETH` style hashtags as inline clickable
 * pills. Body / comment text uses this so authors can drop a token
 * mention and readers can jump to its chart with one click.
 */
function HashtagText({
  body,
  onSymbolClick,
  className = '',
}: {
  body: string;
  onSymbolClick?: (symbol: string) => void;
  className?: string;
}) {
  const segments = useMemo(() => parseHashtags(body), [body]);
  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {segments.map((seg, i) =>
        seg.type === 'tag' ? (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSymbolClick?.(seg.symbol!); }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 hover:text-violet-200 text-[11px] font-bold align-baseline transition-colors"
            title={`Xem chart ${seg.symbol}`}
          >
            <Hash className="w-2.5 h-2.5" />
            {seg.symbol}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

const formatRelative = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'vừa xong';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}p`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 30 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString('vi-VN');
};

const Avatar = ({ src, name }: { src: string | null; name: string }) =>
  src ? (
    <img src={src} alt={name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
  ) : (
    <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-violet-200">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );

export function ForumPanel({ tokenPair, tokenLabel, onSymbolClick }: Props) {
  const { isAuthenticated, user } = useAuth();
  const myUserId = (user as any)?.id ? parseInt((user as any).id) : null;

  const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
  const [posts, setPosts] = useState<ForumPostSummary[]>([]);
  const [activePost, setActivePost] = useState<ForumPostSummary | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── List ──────────────────────────────────────────────────────────────
  const loadList = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (tokenPair) params.set('token_pair', tokenPair);
      const res = await apiClient.get(`/api/forum/posts?${params}`);
      if (res.data?.success) setPosts(res.data.posts);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không tải được diễn đàn');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { if (view === 'list') loadList(); }, [view, tokenPair]); // eslint-disable-line

  // ── Detail ────────────────────────────────────────────────────────────
  const openPost = async (post: ForumPostSummary) => {
    setActivePost(post);
    setView('detail');
    setComments([]);
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/forum/posts/${post.post_id}`);
      if (res.data?.success) {
        setActivePost(res.data.post);
        setComments(res.data.comments);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không tải được bài viết');
    } finally { setLoading(false); }
  };

  const deletePost = async (postId: number) => {
    if (!confirm('Xoá bài viết này?')) return;
    try {
      await apiClient.delete(`/api/forum/posts/${postId}`);
      toast.success('Đã xoá');
      setView('list');
      setPosts(p => p.filter(x => x.post_id !== postId));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xoá thất bại');
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!confirm('Xoá bình luận này?')) return;
    try {
      await apiClient.delete(`/api/forum/comments/${commentId}`);
      toast.success('Đã xoá');
      setComments(cs => cs.filter(c => c.comment_id !== commentId));
      if (activePost) setActivePost({ ...activePost, comment_count: Math.max(0, activePost.comment_count - 1) });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xoá thất bại');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <CreatePostForm
        tokenPair={tokenPair ?? null}
        onCancel={() => setView('list')}
        onCreated={(post) => {
          setPosts((p) => [post, ...p]);
          setView('list');
          toast.success('Đã đăng bài');
        }}
      />
    );
  }

  if (view === 'detail' && activePost) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
          <button onClick={() => { setView('list'); setActivePost(null); }} className="p-1 text-white/40 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
          <span className="text-xs font-bold text-white/70 truncate flex-1">Chi tiết bài viết</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Avatar src={activePost.author_avatar} name={activePost.author_name} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{activePost.author_name}</p>
                <p className="text-[9px] text-white/30">{formatRelative(activePost.created_at)}</p>
              </div>
              {myUserId === activePost.author_id && (
                <button onClick={() => deletePost(activePost.post_id)} className="p-1 text-red-400/60 hover:text-red-400" title="Xoá">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <h3 className="text-sm font-black text-white">
              <HashtagText body={activePost.title} onSymbolClick={onSymbolClick} />
            </h3>
            <HashtagText
              body={activePost.body}
              onSymbolClick={onSymbolClick}
              className="text-xs text-white/70 leading-relaxed block"
            />
          </div>

          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">
              Bình luận ({activePost.comment_count})
            </p>
            {loading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-violet-400" /></div>}
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.comment_id} className={`flex gap-2 ${c.parent_comment_id ? 'ml-4 pl-2 border-l border-white/[0.08]' : ''}`}>
                  <Avatar src={c.author_avatar} name={c.author_name} />
                  <div className="flex-1 min-w-0 bg-white/[0.03] rounded-lg p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold text-white truncate">{c.author_name}</span>
                      <span className="text-[9px] text-white/25">·</span>
                      <span className="text-[9px] text-white/40">{formatRelative(c.created_at)}</span>
                      {myUserId === c.author_id && (
                        <button onClick={() => deleteComment(c.comment_id)} className="ml-auto p-0.5 text-red-400/50 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <HashtagText
                      body={c.body}
                      onSymbolClick={onSymbolClick}
                      className="text-xs text-white/80 block"
                    />
                  </div>
                </div>
              ))}
              {!loading && comments.length === 0 && (
                <p className="text-[11px] text-white/30 italic text-center py-4">Chưa có bình luận. Hãy là người đầu tiên!</p>
              )}
            </div>
          </div>
        </div>
        {isAuthenticated && (
          <CommentBox
            postId={activePost.post_id}
            onCreated={(comment) => {
              setComments((cs) => [...cs, comment]);
              if (activePost) setActivePost({ ...activePost, comment_count: activePost.comment_count + 1 });
            }}
          />
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-bold text-white/70 truncate flex-1">
          Diễn đàn{tokenLabel ? ` · ${tokenLabel}` : ''}
        </span>
        <button onClick={loadList} className="p-1 text-white/30 hover:text-white" title="Làm mới">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        {isAuthenticated && (
          <button
            onClick={() => setView('create')}
            className="p-1 text-violet-400 hover:text-violet-300"
            title="Đăng bài mới"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {posts.length === 0 ? (
          <div className="text-center py-10 text-white/25 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{tokenLabel ? `Chưa có thảo luận về ${tokenLabel}` : 'Chưa có bài viết nào'}</p>
            {isAuthenticated ? (
              <button onClick={() => setView('create')} className="mt-3 text-violet-400 hover:text-violet-300 text-[11px] underline">
                Đăng bài đầu tiên
              </button>
            ) : (
              <p className="mt-2 text-[10px] text-white/20">Đăng nhập để đăng bài.</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {posts.map((p) => (
              <button
                key={p.post_id}
                onClick={() => openPost(p)}
                className="w-full text-left p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Avatar src={p.author_avatar} name={p.author_name} />
                  <span className="text-[10px] font-bold text-white truncate flex-1">{p.author_name}</span>
                  <span className="text-[9px] text-white/30">{formatRelative(p.created_at)}</span>
                </div>
                <p className="text-xs font-semibold text-white/90 line-clamp-2 mb-1">{p.title}</p>
                <p className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">{p.body}</p>
                {/* Hashtag preview chips on the list card. Tag text is stable
                    (uppercase symbols only) so the row layout doesn't jiggle
                    as posts come and go. */}
                {(() => {
                  const tags = extractHashtagSymbols(`${p.title}\n${p.body}`).slice(0, 4);
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tags.map((sym) => (
                        <button
                          key={sym}
                          onClick={(e) => { e.stopPropagation(); onSymbolClick?.(sym); }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-500/10 hover:bg-violet-500/25 text-violet-300/80 hover:text-violet-200 text-[9px] font-bold transition-colors"
                          title={`Xem chart ${sym}`}
                        >
                          <Hash className="w-2 h-2" />{sym}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] text-white/30 flex items-center gap-0.5">
                    <MessageSquare className="w-2.5 h-2.5" /> {p.comment_count}
                  </span>
                  {p.token_pair && (
                    <span className="text-[9px] font-mono text-violet-300/60 truncate">
                      {p.token_pair.slice(0, 6)}…{p.token_pair.slice(-4)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create post form ──────────────────────────────────────────────────────
function CreatePostForm({
  tokenPair,
  onCancel,
  onCreated,
}: {
  tokenPair: string | null;
  onCancel: () => void;
  onCreated: (post: ForumPostSummary) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (title.trim().length < 3) { toast.error('Tiêu đề tối thiểu 3 ký tự'); return; }
    if (body.trim().length < 1) { toast.error('Nội dung không được trống'); return; }
    setSubmitting(true);
    try {
      const res = await apiClient.post('/api/forum/posts', {
        title: title.trim(),
        body: body.trim(),
        token_pair: tokenPair,
      });
      if (res.data?.success) {
        const me = (await apiClient.get('/api/users/profile')).data?.user;
        onCreated({
          ...res.data.post,
          author_id: me?.user_id,
          author_name: me?.username || 'You',
          author_avatar: me?.avatar_url ?? null,
        });
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Đăng bài thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const detectedTags = useMemo(
    () => extractHashtagSymbols(`${title}\n${body}`),
    [title, body],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <button onClick={onCancel} className="p-1 text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        <span className="text-xs font-bold text-white/70 flex-1">Đăng bài mới</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề"
          maxLength={200}
          className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Bạn muốn chia sẻ điều gì? Mention token bằng $BTC, $ETH..."
          rows={8}
          maxLength={8000}
          className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
        />
        {/* Hashtag tip + live preview of detected symbols */}
        <div className="flex items-start gap-1.5 text-[10px] text-white/40">
          <Hash className="w-3 h-3 mt-0.5 flex-shrink-0 text-violet-400" />
          <p className="leading-snug">
            Gõ <code className="text-violet-300">$BTC</code> hoặc <code className="text-violet-300">#ETH</code> để gắn token vào bài.
            Người đọc bấm vào hashtag sẽ thấy chart + thông tin token.
          </p>
        </div>
        {detectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="text-[10px] text-white/40">Đã phát hiện:</span>
            {detectedTags.map((sym) => (
              <span key={sym} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[10px] font-bold">
                <Hash className="w-2 h-2" />{sym}
              </span>
            ))}
          </div>
        )}
        {tokenPair && (
          <p className="text-[10px] text-violet-400/70 pt-1">
            Bài viết sẽ được gắn tag với cặp token {tokenPair.slice(0, 8)}…{tokenPair.slice(-6)}
          </p>
        )}
      </div>
      <div className="border-t border-white/[0.06] p-2 flex gap-2 flex-shrink-0">
        <button onClick={onCancel} className="flex-1 py-2 text-xs font-semibold text-white/60 hover:text-white">
          Huỷ
        </button>
        <button
          onClick={submit}
          disabled={submitting || title.trim().length < 3 || !body.trim()}
          className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Đăng
        </button>
      </div>
    </div>
  );
}

// ─── Comment input ─────────────────────────────────────────────────────────
function CommentBox({ postId, onCreated }: { postId: number; onCreated: (c: ForumComment) => void }) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const submit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post(`/api/forum/posts/${postId}/comments`, { body: body.trim() });
      if (res.data?.success) {
        const me = user as any;
        onCreated({
          ...res.data.comment,
          author_id: me?.id ? parseInt(me.id) : 0,
          author_name: me?.name || me?.username || 'You',
          author_avatar: me?.image ?? null,
        });
        setBody('');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Bình luận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-white/[0.06] p-2 flex-shrink-0">
      <div className="flex items-end gap-2 bg-white/[0.03] rounded-lg p-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Viết bình luận..."
          rows={1}
          maxLength={4000}
          className="flex-1 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none resize-none max-h-20"
        />
        <button
          onClick={submit}
          disabled={submitting || !body.trim()}
          className="w-7 h-7 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center flex-shrink-0"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Send className="w-3 h-3 text-white" />}
        </button>
      </div>
    </div>
  );
}

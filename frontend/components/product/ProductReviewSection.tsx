'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Star, ThumbsUp, ChevronDown, Filter, SortAsc, Image as ImageIcon, Edit3, Check } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Review {
  review_id: number;
  order_id: number;
  product_id: number;
  rating: number;
  title: string | null;
  content: string | null;
  images: string[];
  buyer_name: string;
  buyer_avatar: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

interface ReviewStats {
  avg_rating: number;
  total: number;
  star5: number;
  star4: number;
  star3: number;
  star2: number;
  star1: number;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const StarRating = memo(function StarRating({
  value, size = 'sm', interactive = false, onChange,
}: {
  value: number; size?: 'sm' | 'md' | 'lg'; interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = (interactive ? (hovered || value) : value) >= star;
        return (
          <Star
            key={star}
            className={`${sizes[size]} transition-all duration-150
              ${filled ? 'text-[#f0b90b] fill-[#f0b90b]' : 'text-muted-foreground/30 fill-transparent'}
              ${interactive ? 'cursor-pointer hover:scale-110' : ''}`}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(star)}
          />
        );
      })}
    </div>
  );
});

const RatingBar = memo(function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group cursor-default">
      <span className="text-xs text-muted-foreground w-6 text-right font-bold">{star}</span>
      <Star className="w-3 h-3 text-[#f0b90b] fill-[#f0b90b] flex-shrink-0" />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#f0b90b] to-[#f3ba2f]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: star * 0.05 }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 font-medium">{count}</span>
    </div>
  );
});

function ReviewCard({ review, onHelpful }: { review: Review; onHelpful: (id: number) => void }) {
  const [showImages, setShowImages] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const images = Array.isArray(review.images) ? review.images : (typeof review.images === 'string' ? JSON.parse(review.images || '[]') : []);
  const timeAgo = (() => {
    const diff = Date.now() - new Date(review.created_at).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 30) return `${days} ngày trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 bg-card border border-border rounded-2xl hover:border-border/80 transition-all group"
    >
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f0b90b]/30 to-[#f0b90b]/10 flex items-center justify-center text-[#f0b90b] font-bold text-sm flex-shrink-0 ring-2 ring-[#f0b90b]/10">
          {review.buyer_avatar
            ? <Image src={review.buyer_avatar} alt={review.buyer_name} width={40} height={40} className="rounded-full object-cover" unoptimized />
            : review.buyer_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-foreground">{review.buyer_name}</span>
            <StarRating value={review.rating} size="sm" />
            <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
          </div>
          {review.title && (
            <p className="text-sm font-semibold text-foreground mt-1">{review.title}</p>
          )}
        </div>
      </div>

      {review.content && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-4 pl-13">{review.content}</p>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-4 pl-13">
          {images.slice(0, 4).map((img: string, i: number) => (
            <button
              key={i}
              onClick={() => { setImgIndex(i); setShowImages(true); }}
              className="relative w-16 h-16 rounded-xl overflow-hidden border border-border hover:border-[#f0b90b]/40 transition-colors group/img flex-shrink-0"
            >
              <Image src={img} alt={`Review image ${i + 1}`} fill className="object-cover group-hover/img:scale-110 transition-transform duration-300" unoptimized />
              {i === 3 && images.length > 4 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                  +{images.length - 4}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <button
          onClick={() => onHelpful(review.review_id)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group/helpful"
        >
          <ThumbsUp className="w-3.5 h-3.5 group-hover/helpful:text-[#f0b90b] transition-colors" />
          <span>Hữu ích ({review.helpful_count})</span>
        </button>
        {review.updated_at !== review.created_at && (
          <span className="text-xs text-muted-foreground italic">(đã chỉnh sửa)</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Write Review Form ─────────────────────────────────────────────────────────
function WriteReviewForm({ orderId, productId, onSuccess }: {
  orderId: number; productId: number; onSuccess: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (rating === 0) return toast.error('Vui lòng chọn số sao!');
    setSubmitting(true);
    try {
      await apiClient.post('/api/reviews', { order_id: orderId, rating, title, content });
      toast.success('Đánh giá đã được gửi! Cảm ơn bạn 🎉');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="p-6 bg-gradient-to-br from-[#f0b90b]/5 to-card border border-[#f0b90b]/20 rounded-2xl mb-6">
        <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-[#f0b90b]" /> Viết đánh giá của bạn
        </h3>

        {/* Star picker */}
        <div className="flex items-center gap-4 mb-5">
          <StarRating value={rating} size="lg" interactive onChange={setRating} />
          <span className="text-sm text-muted-foreground">
            {rating === 0 ? 'Chạm vào sao để đánh giá' :
              rating === 1 ? '😞 Rất tệ' : rating === 2 ? '😐 Tệ' :
              rating === 3 ? '😊 Bình thường' : rating === 4 ? '😄 Tốt' : '🤩 Xuất sắc!'}
          </span>
        </div>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Tiêu đề đánh giá (tuỳ chọn)"
          maxLength={100}
          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/40 transition-colors mb-3"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn với sản phẩm này..."
          maxLength={1000}
          rows={4}
          className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f0b90b]/40 transition-colors resize-none mb-4"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={submitting || rating === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#f0b90b] hover:bg-[#e6a800] text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Gửi Đánh Giá
          </button>
          <span className="text-xs text-muted-foreground">{content.length}/1000 ký tự</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main ProductReviewSection ─────────────────────────────────────────────────
interface ProductReviewSectionProps {
  productId: number;
  /** If provided and order is COMPLETED + no review yet, show the write form */
  completedOrderId?: number | null;
}

const SORT_OPTIONS = [
  { value: 'recent',  label: 'Mới nhất' },
  { value: 'helpful', label: 'Hữu ích nhất' },
  { value: 'highest', label: 'Điểm cao nhất' },
  { value: 'lowest',  label: 'Điểm thấp nhất' },
];

export function ProductReviewSection({ productId, completedOrderId }: ProductReviewSectionProps) {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews]     = useState<Review[]>([]);
  const [stats, setStats]         = useState<ReviewStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort]           = useState('recent');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showForm, setShowForm]   = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, page: String(page), limit: '5' });
      if (filterRating) params.set('rating', String(filterRating));
      const res = await apiClient.get(`/api/reviews/product/${productId}?${params}`);
      setReviews(res.data.reviews);
      setStats(res.data.stats);
      setTotalPages(res.data.pagination.pages);
    } catch { /* no reviews */ }
    finally { setLoading(false); }
  }, [productId, sort, page, filterRating]);

  const checkExistingReview = useCallback(async () => {
    if (!completedOrderId || !isAuthenticated) return;
    try {
      const res = await apiClient.get(`/api/reviews/order/${completedOrderId}`);
      setHasReviewed(!!res.data.review);
    } catch { /* ignore */ }
  }, [completedOrderId, isAuthenticated]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);
  useEffect(() => { checkExistingReview(); }, [checkExistingReview]);

  const handleHelpful = async (reviewId: number) => {
    if (!isAuthenticated) return toast.error('Đăng nhập để vote đánh giá helpful!');
    try {
      await apiClient.post(`/api/reviews/${reviewId}/vote`);
      setReviews(prev => prev.map(r => r.review_id === reviewId
        ? { ...r, helpful_count: r.helpful_count + 1 } : r));
    } catch { /* ignore */ }
  };

  const avgRating = stats ? parseFloat(String(stats.avg_rating)) : 0;
  const total = stats ? parseInt(String(stats.total)) : 0;

  return (
    <section className="mt-12" id="reviews">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-foreground">
          Đánh Giá Khách Hàng
          {total > 0 && <span className="ml-2 text-base font-normal text-muted-foreground">({total} đánh giá)</span>}
        </h2>
        {completedOrderId && isAuthenticated && !hasReviewed && (
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] font-bold text-sm rounded-xl border border-[#f0b90b]/20 transition-all"
          >
            <Edit3 className="w-4 h-4" />
            {showForm ? 'Đóng' : 'Viết đánh giá'}
          </button>
        )}
      </div>

      {/* Write form */}
      <AnimatePresence>
        {showForm && completedOrderId && (
          <WriteReviewForm
            orderId={completedOrderId}
            productId={productId}
            onSuccess={() => { setShowForm(false); setHasReviewed(true); fetchReviews(); }}
          />
        )}
      </AnimatePresence>

      {/* Stats overview */}
      {stats && total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8 p-6 bg-card border border-border rounded-2xl">
          {/* Big rating */}
          <div className="md:col-span-2 flex flex-col items-center justify-center text-center">
            <p className="text-6xl font-black text-foreground mb-2">{avgRating.toFixed(1)}</p>
            <StarRating value={Math.round(avgRating)} size="md" />
            <p className="text-sm text-muted-foreground mt-2">{total} đánh giá</p>
          </div>
          {/* Bars */}
          <div className="md:col-span-3 space-y-2 justify-center flex flex-col">
            {([5, 4, 3, 2, 1] as const).map(star => (
              <button
                key={star}
                onClick={() => setFilterRating(filterRating === star ? null : star)}
                className={`w-full transition-opacity ${filterRating && filterRating !== star ? 'opacity-40' : 'opacity-100'}`}
              >
                <RatingBar star={star} count={Number(stats[`star${star}` as keyof ReviewStats])} total={total} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort & Filter controls */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SortAsc className="w-4 h-4" /> Sắp xếp:
          </div>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSort(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sort === opt.value
                  ? 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {filterRating && (
            <button
              onClick={() => setFilterRating(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5"
            >
              <Filter className="w-3 h-3" /> {filterRating}★ ✕
            </button>
          )}
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-5 bg-card border border-border rounded-2xl animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {reviews.map((review, i) => (
              <motion.div key={review.review_id} layout transition={{ delay: i * 0.05 }}>
                <ReviewCard review={review} onHelpful={handleHelpful} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    p === page
                      ? 'bg-[#f0b90b] text-black shadow-lg shadow-yellow-500/20'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-foreground font-bold mb-1">Chưa có đánh giá nào</p>
          <p className="text-sm text-muted-foreground">Hãy là người đầu tiên đánh giá sản phẩm này!</p>
        </div>
      )}
    </section>
  );
}

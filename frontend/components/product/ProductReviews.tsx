'use client';

import { motion } from 'framer-motion';
import { Star, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Review {
    id: number;
    userName: string;
    rating: number;
    comment: string;
    date: string;
    verified: boolean;
}

interface ProductReviewsProps {
    productId: number;
    averageRating?: number;
    totalReviews?: number;
}

// Mock data for demonstration - replace with API call
const mockReviews: Review[] = [
    {
        id: 1,
        userName: 'CryptoTrader123',
        rating: 5,
        comment: 'Excellent product! Fast delivery and exactly as described. The seller was very responsive.',
        date: '2024-01-15',
        verified: true,
    },
    {
        id: 2,
        userName: 'BlockchainBuyer',
        rating: 4,
        comment: 'Good quality product. Shipping took a bit longer than expected but overall satisfied.',
        date: '2024-01-10',
        verified: true,
    },
    {
        id: 3,
        userName: 'Web3Shopper',
        rating: 5,
        comment: 'Amazing experience! Love the escrow protection feature. Will definitely buy again.',
        date: '2024-01-05',
        verified: false,
    },
];

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    size={size}
                    className={`${star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
                        }`}
                />
            ))}
        </div>
    );
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {review.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{review.userName}</span>
                        {review.verified && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                Verified Purchase
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} size={14} />
                        <span className="text-sm text-muted-foreground">
                            {new Date(review.date).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {review.comment}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

export function ProductReviews({ productId, averageRating = 4.5, totalReviews = 42 }: ProductReviewsProps) {
    // In a real implementation, fetch reviews from API using productId
    const reviews = mockReviews;

    const ratingDistribution = [
        { stars: 5, percentage: 70 },
        { stars: 4, percentage: 20 },
        { stars: 3, percentage: 5 },
        { stars: 2, percentage: 3 },
        { stars: 1, percentage: 2 },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 pt-8 border-t"
        >
            <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

            <div className="grid md:grid-cols-3 gap-8 mb-8">
                {/* Rating Summary */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 rounded-2xl p-6 text-center">
                    <div className="text-5xl font-bold mb-2">{averageRating.toFixed(1)}</div>
                    <StarRating rating={Math.round(averageRating)} size={24} />
                    <p className="text-muted-foreground mt-2">Based on {totalReviews} reviews</p>
                </div>

                {/* Rating Distribution */}
                <div className="md:col-span-2 space-y-2">
                    {ratingDistribution.map(({ stars, percentage }) => (
                        <div key={stars} className="flex items-center gap-3">
                            <span className="text-sm w-16 text-right">{stars} stars</span>
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.5, delay: 0.2 + stars * 0.05 }}
                                    className="h-full bg-yellow-400 rounded-full"
                                />
                            </div>
                            <span className="text-sm w-12 text-muted-foreground">{percentage}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-4 mb-6">
                {reviews.map((review, index) => (
                    <ReviewCard key={review.id} review={review} index={index} />
                ))}
            </div>

            {/* Load More Button */}
            <div className="text-center">
                <Button variant="outline" className="px-8">
                    Load More Reviews
                </Button>
            </div>

            {/* Write Review CTA */}
            <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="font-semibold text-lg mb-1">Have you purchased this product?</h3>
                        <p className="text-muted-foreground text-sm">Share your experience with other buyers</p>
                    </div>
                    <Button className="px-6">
                        <Star className="w-4 h-4 mr-2" />
                        Write a Review
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

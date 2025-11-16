import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  images: string[];
  priceInCoins: number;
  priceInUSD: number;
  coinSymbol: string;
  coinLogo: string;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';
  status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'SUSPENDED' | 'DELETED';
  quantity: number;
  location: string;
  tags: string[];
  views: number;
  likes: number[];
  rating?: number;
  reviews?: number;
  tokenized: boolean;
  tokenAddress?: string;
  tokenId?: string;
  metadata?: any;
  searchVector?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    sellerId: { type: String, required: true, index: true },
    sellerName: { type: String, required: true },
    sellerAvatar: { type: String },
    title: { type: String, required: true, index: 'text' },
    description: { type: String, required: true, index: 'text' },
    category: { type: String, required: true, index: true },
    subCategory: { type: String, index: true },
    images: [{ type: String, required: true }],
    priceInCoins: { type: Number, required: true, index: true },
    priceInUSD: { type: Number, required: true, index: true },
    coinSymbol: { type: String, default: 'BTC' },
    coinLogo: { type: String, default: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
    condition: {
      type: String,
      enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'],
      default: 'GOOD',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'SOLD', 'SUSPENDED', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    quantity: { type: Number, required: true, default: 1 },
    location: { type: String, required: true },
    tags: [{ type: String, index: true }],
    views: { type: Number, default: 0 },
    likes: [{ type: String }],
    rating: { type: Number, default: 4.5 },
    reviews: { type: Number, default: 0 },
    tokenized: { type: Boolean, default: false },
    tokenAddress: { type: String },
    tokenId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    searchVector: { type: String },
  },
  {
    timestamps: true,
  }
);

// Text index for search
ProductSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Compound indexes for common queries
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ sellerId: 1, status: 1 });
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ priceInCoins: 1, status: 1 });

// Update search vector before save (for semantic search)
ProductSchema.pre('save', function (next) {
  this.searchVector = `${this.title} ${this.description} ${this.tags.join(' ')} ${this.category}`.toLowerCase();
  next();
});

export default mongoose.model<IProduct>('Product', ProductSchema);


import mongoose, { Document, Schema } from 'mongoose';

export interface IShop extends Document {
  sellerId: string; // Reference to User ID
  shopName: string;
  shopDescription?: string;
  shopLogo?: string;
  shopBanner?: string;
  shopRating?: number;
  totalReviews?: number;
  totalSales?: number;
  totalProducts?: number;
  verified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  contactEmail?: string;
  contactPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks?: {
    website?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  businessHours?: {
    [key: string]: {
      open: string;
      close: string;
      closed?: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ShopSchema = new Schema<IShop>(
  {
    sellerId: { type: String, required: true, unique: true, index: true },
    shopName: { type: String, required: true, index: 'text' },
    shopDescription: { type: String, index: 'text' },
    shopLogo: { type: String },
    shopBanner: { type: String },
    shopRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
      default: 'ACTIVE',
      index: true,
    },
    contactEmail: { type: String },
    contactPhone: { type: String },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      zipCode: { type: String },
    },
    socialLinks: {
      website: { type: String },
      facebook: { type: String },
      twitter: { type: String },
      instagram: { type: String },
    },
    businessHours: {
      type: Map,
      of: {
        open: String,
        close: String,
        closed: Boolean,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ShopSchema.index({ sellerId: 1, status: 1 });
ShopSchema.index({ shopName: 'text', shopDescription: 'text' });
ShopSchema.index({ verified: 1, status: 1, shopRating: -1 });

export default mongoose.model<IShop>('Shop', ShopSchema);


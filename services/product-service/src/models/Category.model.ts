import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentCategory?: string;
  order: number;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    image: { type: String },
    parentCategory: { type: String, index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    productCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

CategorySchema.index({ isActive: 1, order: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema);


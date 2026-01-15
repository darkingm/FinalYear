import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  images: string[];
  likes: string[];
  shares: number;
  commentsCount: number;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  tags: string[];
  isEdited: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    userAvatar: { type: String },
    content: { type: String, required: true, maxlength: 5000 },
    images: [{ type: String }],
    likes: [{ type: String }],
    shares: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'FRIENDS', 'PRIVATE'],
      default: 'PUBLIC',
      index: true,
    },
    tags: [{ type: String, index: true }],
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ content: 'text' });

export default mongoose.model<IPost>('Post', PostSchema);


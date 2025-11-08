import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  postId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  parentCommentId?: string; // For nested comments (replies)
  likes: string[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    userAvatar: { type: String },
    content: { type: String, required: true, maxlength: 1000 },
    parentCommentId: { type: String, index: true },
    likes: [{ type: String }],
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
CommentSchema.index({ postId: 1, createdAt: 1 });
CommentSchema.index({ userId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1 });

export default mongoose.model<IComment>('Comment', CommentSchema);


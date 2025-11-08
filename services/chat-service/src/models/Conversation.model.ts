import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participants: string[]; // Array of user IDs
  participantDetails: Array<{
    userId: string;
    username: string;
    avatar?: string;
    role: 'USER' | 'SUPPORT' | 'ADMIN';
  }>;
  type: 'SUPPORT' | 'DIRECT'; // Support ticket or direct message
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  lastMessageAt?: Date;
  lastMessage?: string;
  unreadCount: Map<string, number>; // userId -> unread count
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: String, required: true, index: true }],
    participantDetails: [
      {
        userId: { type: String, required: true },
        username: { type: String, required: true },
        avatar: { type: String },
        role: {
          type: String,
          enum: ['USER', 'SUPPORT', 'ADMIN'],
          required: true,
        },
      },
    ],
    type: {
      type: String,
      enum: ['SUPPORT', 'DIRECT'],
      default: 'DIRECT',
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    lastMessageAt: { type: Date },
    lastMessage: { type: String },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ConversationSchema.index({ participants: 1, status: 1 });
ConversationSchema.index({ type: 1, status: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model<IConversation>('Conversation', ConversationSchema);


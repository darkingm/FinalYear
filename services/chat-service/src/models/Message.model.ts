import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  attachments: Array<{
    url: string;
    filename: string;
    filesize: number;
    mimetype: string;
  }>;
  readBy: string[]; // Array of user IDs who read this message
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: { type: String },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'],
      default: 'TEXT',
    },
    attachments: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        filesize: { type: Number },
        mimetype: { type: String },
      },
    ],
    readBy: [{ type: String }],
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });

export default mongoose.model<IMessage>('Message', MessageSchema);


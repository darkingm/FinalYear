import mongoose, { Document, Schema } from 'mongoose';

export interface ITicket extends Document {
  ticketNumber: string;
  userId: string;
  username: string;
  subject: string;
  description: string;
  category: 'TECHNICAL' | 'BILLING' | 'PRODUCT' | 'ACCOUNT' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  conversationId?: string;
  assignedTo?: string; // Support/Admin user ID
  assignedToName?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: ['TECHNICAL', 'BILLING', 'PRODUCT', 'ACCOUNT', 'OTHER'],
      default: 'OTHER',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    conversationId: {
      type: String,
      index: true,
    },
    assignedTo: {
      type: String,
      index: true,
    },
    assignedToName: { type: String },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Indexes
TicketSchema.index({ userId: 1, status: 1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ status: 1, priority: -1, createdAt: -1 });

// Generate ticket number before save
TicketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    this.ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  next();
});

export default mongoose.model<ITicket>('Ticket', TicketSchema);


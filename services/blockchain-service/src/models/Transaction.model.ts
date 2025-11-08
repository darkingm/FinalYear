import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  txHash: string;
  blockNumber: number;
  blockTimestamp: Date;
  
  // Transaction details
  from: string;
  to: string;
  value: string; // Wei amount
  gasUsed: number;
  gasPrice: string;
  
  // Token transfer
  tokenId?: string;
  contractAddress?: string;
  
  // Type
  type: 'MINT' | 'TRANSFER' | 'BURN' | 'APPROVAL';
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  
  // Metadata
  metadata?: any;
  errorMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    blockNumber: { type: Number, required: true },
    blockTimestamp: { type: Date, required: true },
    
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    value: { type: String, required: true },
    gasUsed: { type: Number, required: true },
    gasPrice: { type: String, required: true },
    
    tokenId: { type: String, index: true },
    contractAddress: { type: String, index: true },
    
    type: {
      type: String,
      enum: ['MINT', 'TRANSFER', 'BURN', 'APPROVAL'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'FAILED'],
      default: 'PENDING',
    },
    
    metadata: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
TransactionSchema.index({ from: 1, createdAt: -1 });
TransactionSchema.index({ to: 1, createdAt: -1 });
TransactionSchema.index({ status: 1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);


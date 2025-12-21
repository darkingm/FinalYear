import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  txHash: string;
  networkId: string;
  blockNumber?: number;
  blockHash?: string;
  blockTimestamp?: Date;
  
  // Transaction details
  from: string;
  to: string;
  value: string; // Amount in smallest unit
  gasUsed?: number;
  gasPrice?: string;
  gasLimit?: number;
  nonce?: number;
  confirmations: number;
  
  // Token transfer
  tokenId?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  
  // Swap details
  swapFromToken?: string;
  swapToToken?: string;
  swapFromAmount?: string;
  swapToAmount?: string;
  swapDex?: string;
  
  // Type
  type: 'TRANSFER_NATIVE' | 'TRANSFER_TOKEN' | 'SWAP' | 'MINT' | 'BURN' | 'APPROVAL';
  status: 'PENDING' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED';
  
  // Metadata
  metadata?: any;
  errorMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    txHash: { type: String, required: true, index: true },
    networkId: { type: String, required: true, index: true },
    blockNumber: { type: Number, index: true },
    blockHash: { type: String },
    blockTimestamp: { type: Date },
    
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    value: { type: String, required: true },
    gasUsed: { type: Number },
    gasPrice: { type: String },
    gasLimit: { type: Number },
    nonce: { type: Number },
    confirmations: { type: Number, default: 0, index: true },
    
    tokenId: { type: String, index: true },
    contractAddress: { type: String, index: true },
    tokenSymbol: { type: String },
    tokenDecimals: { type: Number },
    
    swapFromToken: { type: String },
    swapToToken: { type: String },
    swapFromAmount: { type: String },
    swapToAmount: { type: String },
    swapDex: { type: String },
    
    type: {
      type: String,
      enum: ['TRANSFER_NATIVE', 'TRANSFER_TOKEN', 'SWAP', 'MINT', 'BURN', 'APPROVAL'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMING', 'CONFIRMED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    
    metadata: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
TransactionSchema.index({ networkId: 1, txHash: 1 }, { unique: true });
TransactionSchema.index({ networkId: 1, from: 1, createdAt: -1 });
TransactionSchema.index({ networkId: 1, to: 1, createdAt: -1 });
TransactionSchema.index({ networkId: 1, status: 1 });
TransactionSchema.index({ networkId: 1, type: 1 });
TransactionSchema.index({ createdAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);


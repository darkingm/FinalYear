import mongoose, { Document, Schema } from 'mongoose';

export interface INetwork extends Document {
  networkId: string;
  name: string;
  type: 'BITCOIN' | 'EVM';
  environment: 'mainnet' | 'testnet';
  chainId?: number;
  rpcUrl: string;
  rpcUrlFallback?: string[];
  explorerUrl: string;
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
  };
  blockTime: number;
  isTestnet: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NetworkSchema = new Schema<INetwork>(
  {
    networkId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['BITCOIN', 'EVM'],
      required: true,
    },
    environment: {
      type: String,
      enum: ['mainnet', 'testnet'],
      required: true,
    },
    chainId: { type: Number, index: true },
    rpcUrl: { type: String, required: true },
    rpcUrlFallback: [{ type: String }],
    explorerUrl: { type: String, required: true },
    nativeCurrency: {
      symbol: { type: String, required: true },
      name: { type: String, required: true },
      decimals: { type: Number, required: true },
    },
    blockTime: { type: Number, required: true },
    isTestnet: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
NetworkSchema.index({ type: 1, isActive: 1 });
NetworkSchema.index({ chainId: 1, isTestnet: 1 });

export default mongoose.model<INetwork>('Network', NetworkSchema);




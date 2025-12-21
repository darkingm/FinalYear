import mongoose, { Document, Schema } from 'mongoose';

export interface ICoin extends Document {
  symbol: string;
  name: string;
  networkId: string;
  contractAddress?: string; // undefined for native coins
  decimals: number;
  coinType: 'NATIVE' | 'TOKEN';
  tokenStandard?: 'ERC20' | 'BEP20' | 'ERC721' | 'ERC1155';
  logoUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CoinSchema = new Schema<ICoin>(
  {
    symbol: { type: String, required: true, index: true },
    name: { type: String, required: true },
    networkId: { type: String, required: true, index: true },
    contractAddress: { type: String, index: true },
    decimals: { type: Number, required: true },
    coinType: {
      type: String,
      enum: ['NATIVE', 'TOKEN'],
      required: true,
      index: true,
    },
    tokenStandard: {
      type: String,
      enum: ['ERC20', 'BEP20', 'ERC721', 'ERC1155'],
    },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
CoinSchema.index({ networkId: 1, symbol: 1 }, { unique: true });
CoinSchema.index({ networkId: 1, contractAddress: 1 });
CoinSchema.index({ coinType: 1, isActive: 1 });

export default mongoose.model<ICoin>('Coin', CoinSchema);




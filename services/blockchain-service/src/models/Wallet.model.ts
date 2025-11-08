import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  userId: string;
  address: string;
  encryptedPrivateKey: string;
  
  // Balance
  balance: string; // Wei amount
  tokenBalance: Array<{
    tokenId: string;
    contractAddress: string;
    balance: number;
  }>;
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    address: { type: String, required: true, unique: true, index: true },
    encryptedPrivateKey: { type: String, required: true },
    
    balance: { type: String, default: '0' },
    tokenBalance: [
      {
        tokenId: String,
        contractAddress: String,
        balance: Number,
      },
    ],
    
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IWallet>('Wallet', WalletSchema);


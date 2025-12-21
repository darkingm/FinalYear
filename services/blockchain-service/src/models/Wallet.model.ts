import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletAddress {
  networkId: string;
  address: string;
  encryptedPrivateKey: string;
  balance: string; // Native coin balance
  tokenBalances: Array<{
    contractAddress: string;
    symbol: string;
    balance: string;
    decimals: number;
  }>;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet extends Document {
  userId: string;
  addresses: IWalletAddress[];
  
  // Legacy fields for backward compatibility
  address?: string;
  encryptedPrivateKey?: string;
  balance?: string;
  tokenBalance?: Array<{
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

const WalletAddressSchema = new Schema<IWalletAddress>(
  {
    networkId: { type: String, required: true, index: true },
    address: { type: String, required: true, index: true },
    encryptedPrivateKey: { type: String, required: true },
    balance: { type: String, default: '0' },
    tokenBalances: [
      {
        contractAddress: { type: String, required: true },
        symbol: { type: String, required: true },
        balance: { type: String, required: true },
        decimals: { type: Number, required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    addresses: [WalletAddressSchema],
    
    // Legacy fields for backward compatibility
    address: { type: String, index: true },
    encryptedPrivateKey: { type: String },
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

// Indexes
WalletSchema.index({ 'addresses.networkId': 1, 'addresses.address': 1 }, { unique: true, sparse: true });
WalletSchema.index({ 'addresses.networkId': 1 });

export default mongoose.model<IWallet>('Wallet', WalletSchema);


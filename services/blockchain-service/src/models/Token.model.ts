import mongoose, { Document, Schema } from 'mongoose';

export interface IToken extends Document {
  tokenId: string;
  productId: string;
  ownerId: string;
  ownerAddress: string;
  
  // Token metadata
  name: string;
  symbol: string;
  tokenType: 'ERC721' | 'ERC1155'; // NFT standards
  
  // Asset details
  assetDescription: string;
  assetValue: number;
  assetImages: string[];
  
  // Blockchain details
  contractAddress: string;
  tokenURI: string;
  blockNumber: number;
  transactionHash: string;
  
  // Status
  status: 'MINTED' | 'TRANSFERRED' | 'BURNED';
  isFractional: boolean;
  totalSupply: number;
  
  // Transfer history
  transferHistory: Array<{
    from: string;
    to: string;
    timestamp: Date;
    txHash: string;
  }>;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema = new Schema<IToken>(
  {
    tokenId: { type: String, required: true, unique: true, index: true },
    productId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    ownerAddress: { type: String, required: true },
    
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    tokenType: {
      type: String,
      enum: ['ERC721', 'ERC1155'],
      default: 'ERC721',
    },
    
    assetDescription: { type: String, required: true },
    assetValue: { type: Number, required: true },
    assetImages: [{ type: String }],
    
    contractAddress: { type: String, required: true },
    tokenURI: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    transactionHash: { type: String, required: true },
    
    status: {
      type: String,
      enum: ['MINTED', 'TRANSFERRED', 'BURNED'],
      default: 'MINTED',
    },
    isFractional: { type: Boolean, default: false },
    totalSupply: { type: Number, default: 1 },
    
    transferHistory: [
      {
        from: String,
        to: String,
        timestamp: Date,
        txHash: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
TokenSchema.index({ ownerId: 1, status: 1 });
TokenSchema.index({ productId: 1 });
TokenSchema.index({ contractAddress: 1, tokenId: 1 });

export default mongoose.model<IToken>('Token', TokenSchema);


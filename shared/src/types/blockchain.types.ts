export enum TransactionType {
  TRANSFER = 'TRANSFER',
  MINT = 'MINT',
  BURN = 'BURN',
  ESCROW = 'ESCROW',
  RELEASE = 'RELEASE',
  TOKENIZE_ASSET = 'TOKENIZE_ASSET',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export interface IBlockchainTransaction {
  id: string;
  hash: string;
  type: TransactionType;
  from: string;
  to: string;
  amount: string;
  tokenAddress?: string;
  tokenId?: string;
  blockNumber?: number;
  blockHash?: string;
  status: TransactionStatus;
  confirmations: number;
  gasUsed?: string;
  gasPrice?: string;
  nonce: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  confirmedAt?: Date;
}

export interface IBlock {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: Date;
  transactions: string[];
  miner: string;
  difficulty: number;
  gasLimit: string;
  gasUsed: string;
}

export interface ITokenizedAsset {
  tokenId: string;
  tokenAddress: string;
  assetType: string;
  productId: string;
  ownerId: string;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes: Record<string, any>;
  };
  totalSupply: number;
  mintedAt: Date;
  transferHistory: Array<{
    from: string;
    to: string;
    timestamp: Date;
    transactionHash: string;
  }>;
}

export interface ISmartContract {
  address: string;
  name: string;
  type: 'ERC20' | 'ERC721' | 'ERC1155' | 'ESCROW' | 'CUSTOM';
  abi: any[];
  deployedAt: Date;
  deployedBy: string;
  deployTransactionHash: string;
}

export interface ICreateTransactionRequest {
  type: TransactionType;
  from: string;
  to: string;
  amount: string;
  tokenAddress?: string;
  tokenId?: string;
  metadata?: Record<string, any>;
}

export interface ITokenizeAssetRequest {
  productId: string;
  assetType: string;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes: Record<string, any>;
  };
  totalSupply?: number;
}

export interface IEscrowRequest {
  amount: string;
  buyer: string;
  seller: string;
  orderId: string;
  expiresIn: number;
}


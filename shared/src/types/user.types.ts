export enum UserRole {
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
  SELLER = 'SELLER',
  USER = 'USER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export enum KYCStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KYCStatus;
  avatar?: string;
  bio?: string;
  coinBalance: number;
  fiatBalance: number;
  bankAccountVerified: boolean;
  bankAccountNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  showBalance: boolean;
  showCoinBalance: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface IUserProfile extends Omit<IUser, 'bankAccountNumber'> {
  totalOrders: number;
  totalSpent: number;
  totalEarned: number;
  sellerRating?: number;
  sellerTotalSales?: number;
}

export interface ISellerApplication {
  userId: string;
  businessName: string;
  businessType: string;
  businessDescription: string;
  businessAddress: string;
  taxId?: string;
  website?: string;
  documents: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  appliedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}


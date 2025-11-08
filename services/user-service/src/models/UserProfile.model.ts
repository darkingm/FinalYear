import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum UserRole {
  USER = 'USER',
  SELLER = 'SELLER',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

interface UserProfileAttributes {
  id: string;
  userId: string; // From auth service
  email: string;
  username: string;
  fullName: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  dateOfBirth?: Date;
  country?: string;
  city?: string;
  address?: string;
  role: UserRole;
  
  // Seller specific
  isSeller: boolean;
  sellerVerified: boolean;
  sellerVerificationDate?: Date;
  shopName?: string;
  shopDescription?: string;
  taxId?: string;
  
  // Bank account verification
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankVerified: boolean;
  bankVerificationStatus: VerificationStatus;
  
  // Privacy settings
  showCoinBalance: boolean;
  showJoinDate: boolean;
  showEmail: boolean;
  showPhone: boolean;
  
  // Statistics
  totalSales: number;
  totalPurchases: number;
  rating: number;
  reviewCount: number;
  
  // Status
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  lastLoginAt?: Date;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserProfileCreationAttributes
  extends Optional<
    UserProfileAttributes,
    'id' | 'avatar' | 'bio' | 'phone' | 'dateOfBirth' | 'country' | 'city' | 'address' |
    'isSeller' | 'sellerVerified' | 'shopName' | 'shopDescription' | 'taxId' |
    'bankName' | 'bankAccountNumber' | 'bankAccountName' | 'bankVerified' | 'bankVerificationStatus' |
    'showCoinBalance' | 'showJoinDate' | 'showEmail' | 'showPhone' |
    'totalSales' | 'totalPurchases' | 'rating' | 'reviewCount' |
    'isActive' | 'isSuspended' | 'lastLoginAt'
  > {}

class UserProfile extends Model<UserProfileAttributes, UserProfileCreationAttributes> implements UserProfileAttributes {
  declare id: string;
  declare userId: string;
  declare email: string;
  declare username: string;
  declare fullName: string;
  declare avatar?: string;
  declare bio?: string;
  declare phone?: string;
  declare dateOfBirth?: Date;
  declare country?: string;
  declare city?: string;
  declare address?: string;
  declare role: UserRole;
  
  declare isSeller: boolean;
  declare sellerVerified: boolean;
  declare sellerVerificationDate?: Date;
  declare shopName?: string;
  declare shopDescription?: string;
  declare taxId?: string;
  
  declare bankName?: string;
  declare bankAccountNumber?: string;
  declare bankAccountName?: string;
  declare bankVerified: boolean;
  declare bankVerificationStatus: VerificationStatus;
  
  declare showCoinBalance: boolean;
  declare showJoinDate: boolean;
  declare showEmail: boolean;
  declare showPhone: boolean;
  
  declare totalSales: number;
  declare totalPurchases: number;
  declare rating: number;
  declare reviewCount: number;
  
  declare isActive: boolean;
  declare isSuspended: boolean;
  declare suspensionReason?: string;
  declare lastLoginAt?: Date;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

UserProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'user_id',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'full_name',
    },
    avatar: {
      type: DataTypes.STRING,
    },
    bio: {
      type: DataTypes.TEXT,
    },
    phone: {
      type: DataTypes.STRING,
    },
    dateOfBirth: {
      type: DataTypes.DATE,
      field: 'date_of_birth',
    },
    country: {
      type: DataTypes.STRING,
    },
    city: {
      type: DataTypes.STRING,
    },
    address: {
      type: DataTypes.TEXT,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      defaultValue: UserRole.USER,
    },
    
    // Seller fields
    isSeller: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_seller',
    },
    sellerVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'seller_verified',
    },
    sellerVerificationDate: {
      type: DataTypes.DATE,
      field: 'seller_verification_date',
    },
    shopName: {
      type: DataTypes.STRING,
      field: 'shop_name',
    },
    shopDescription: {
      type: DataTypes.TEXT,
      field: 'shop_description',
    },
    taxId: {
      type: DataTypes.STRING,
      field: 'tax_id',
    },
    
    // Bank fields
    bankName: {
      type: DataTypes.STRING,
      field: 'bank_name',
    },
    bankAccountNumber: {
      type: DataTypes.STRING,
      field: 'bank_account_number',
    },
    bankAccountName: {
      type: DataTypes.STRING,
      field: 'bank_account_name',
    },
    bankVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'bank_verified',
    },
    bankVerificationStatus: {
      type: DataTypes.ENUM(...Object.values(VerificationStatus)),
      defaultValue: VerificationStatus.PENDING,
      field: 'bank_verification_status',
    },
    
    // Privacy settings
    showCoinBalance: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_coin_balance',
    },
    showJoinDate: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_join_date',
    },
    showEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'show_email',
    },
    showPhone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'show_phone',
    },
    
    // Statistics
    totalSales: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_sales',
    },
    totalPurchases: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_purchases',
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      validate: {
        min: 0,
        max: 5,
      },
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'review_count',
    },
    
    // Status
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    isSuspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_suspended',
    },
    suspensionReason: {
      type: DataTypes.TEXT,
      field: 'suspension_reason',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      field: 'last_login_at',
    },
  },
  {
    sequelize,
    tableName: 'user_profiles',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['email'] },
      { fields: ['username'] },
      { fields: ['role'] },
      { fields: ['is_seller'] },
      { fields: ['seller_verified'] },
      { fields: ['bank_verified'] },
    ],
  }
);

export default UserProfile;


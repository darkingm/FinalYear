import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

interface SellerApplicationAttributes {
  id: string;
  userId: string;
  shopName: string;
  shopDescription: string;
  taxId?: string;
  businessType: string;
  businessAddress: string;
  phoneNumber: string;
  website?: string;
  
  // Documents
  businessLicense?: string;
  taxCertificate?: string;
  identityDocument?: string;
  
  // Bank info
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  
  // Status
  status: ApplicationStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface SellerApplicationCreationAttributes
  extends Optional<
    SellerApplicationAttributes,
    'id' | 'taxId' | 'website' | 'businessLicense' | 'taxCertificate' | 'identityDocument' |
    'status' | 'reviewedBy' | 'reviewedAt' | 'rejectionReason'
  > {}

class SellerApplication
  extends Model<SellerApplicationAttributes, SellerApplicationCreationAttributes>
  implements SellerApplicationAttributes {
  declare id: string;
  declare userId: string;
  declare shopName: string;
  declare shopDescription: string;
  declare taxId?: string;
  declare businessType: string;
  declare businessAddress: string;
  declare phoneNumber: string;
  declare website?: string;
  
  declare businessLicense?: string;
  declare taxCertificate?: string;
  declare identityDocument?: string;
  
  declare bankName: string;
  declare bankAccountNumber: string;
  declare bankAccountName: string;
  
  declare status: ApplicationStatus;
  declare reviewedBy?: string;
  declare reviewedAt?: Date;
  declare rejectionReason?: string;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SellerApplication.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
    },
    shopName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'shop_name',
    },
    shopDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'shop_description',
    },
    taxId: {
      type: DataTypes.STRING,
      field: 'tax_id',
    },
    businessType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'business_type',
    },
    businessAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'business_address',
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'phone_number',
    },
    website: {
      type: DataTypes.STRING,
    },
    
    businessLicense: {
      type: DataTypes.STRING,
      field: 'business_license',
    },
    taxCertificate: {
      type: DataTypes.STRING,
      field: 'tax_certificate',
    },
    identityDocument: {
      type: DataTypes.STRING,
      field: 'identity_document',
    },
    
    bankName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_name',
    },
    bankAccountNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_account_number',
    },
    bankAccountName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'bank_account_name',
    },
    
    status: {
      type: DataTypes.ENUM(...Object.values(ApplicationStatus)),
      defaultValue: ApplicationStatus.PENDING,
    },
    reviewedBy: {
      type: DataTypes.STRING,
      field: 'reviewed_by',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      field: 'reviewed_at',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      field: 'rejection_reason',
    },
  },
  {
    sequelize,
    tableName: 'seller_applications',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
    ],
  }
);

export default SellerApplication;


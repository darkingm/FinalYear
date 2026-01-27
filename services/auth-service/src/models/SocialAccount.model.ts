import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

export enum SocialProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  MICROSOFT = 'microsoft',
}

interface SocialAccountAttributes {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  email?: string;
  isVerified: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  profileData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SocialAccountCreationAttributes extends Optional<SocialAccountAttributes, 'id'> {}

class SocialAccount extends Model<SocialAccountAttributes, SocialAccountCreationAttributes> 
  implements SocialAccountAttributes {
  declare id: string;
  declare userId: string;
  declare provider: SocialProvider;
  declare providerUserId: string;
  declare email?: string;
  declare isVerified: boolean;
  declare accessToken?: string;
  declare refreshToken?: string;
  declare tokenExpiresAt?: Date;
  declare profileData?: Record<string, any>;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SocialAccount.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    provider: {
      type: DataTypes.ENUM(...Object.values(SocialProvider)),
      allowNull: false,
    },
    providerUserId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'provider_user_id',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token',
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token',
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'token_expires_at',
    },
    profileData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'profile_data',
    },
  },
  {
    sequelize,
    tableName: 'social_accounts',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { unique: true, fields: ['provider', 'provider_user_id'] },
      { fields: ['email'] },
    ],
  }
);

export default SocialAccount;

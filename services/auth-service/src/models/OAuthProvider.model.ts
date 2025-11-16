import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import User from './User.model';

interface OAuthProviderAttributes {
  id: string;
  userId: string;
  provider: 'GOOGLE' | 'FACEBOOK' | 'MICROSOFT';
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  profile?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

interface OAuthProviderCreationAttributes extends Optional<OAuthProviderAttributes, 'id'> {}

class OAuthProvider extends Model<OAuthProviderAttributes, OAuthProviderCreationAttributes> implements OAuthProviderAttributes {
  // Chỉ dùng declare để TypeScript biết các thuộc tính, KHÔNG khai báo public fields
  declare id: string;
  declare userId: string;
  declare provider: 'GOOGLE' | 'FACEBOOK' | 'MICROSOFT';
  declare providerId: string;
  declare accessToken?: string;
  declare refreshToken?: string;
  declare profile?: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

OAuthProvider.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    provider: {
      type: DataTypes.ENUM('GOOGLE', 'FACEBOOK', 'MICROSOFT'),
      allowNull: false,
    },
    providerId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profile: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'OAuthProviders',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['provider', 'providerId'] },
      { fields: ['userId'] },
    ],
  }
);

// Associations
User.hasMany(OAuthProvider, { foreignKey: 'userId', as: 'oauthProviders' });
OAuthProvider.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default OAuthProvider;
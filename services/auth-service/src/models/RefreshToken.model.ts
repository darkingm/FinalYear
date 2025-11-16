import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import User from './User.model';

interface RefreshTokenAttributes {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdByIp?: string;
  revokedAt?: Date | null;
  revokedByIp?: string | null;
  replacedByToken?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RefreshTokenCreationAttributes extends Optional<RefreshTokenAttributes, 'id'> {}

class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  // Chỉ dùng declare, không khai báo public fields
  declare id: string;
  declare userId: string;
  declare token: string;
  declare expiresAt: Date;
  declare createdByIp?: string;
  declare revokedAt?: Date | null;
  declare revokedByIp?: string | null;
  declare replacedByToken?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RefreshToken.init(
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
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdByIp: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revokedByIp: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    replacedByToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'RefreshTokens',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['token'] },
      { fields: ['revokedAt'] },
      { fields: ['expiresAt'] },
    ],
  }
);

// Associations
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default RefreshToken;
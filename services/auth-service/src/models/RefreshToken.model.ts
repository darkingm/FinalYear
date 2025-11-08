import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import User from './User.model';

interface RefreshTokenAttributes {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdByIp: string;
  revokedAt?: Date;
  revokedByIp?: string;
  replacedByToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RefreshTokenCreationAttributes extends Optional<RefreshTokenAttributes, 'id'> {}

class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  public id!: string;
  public userId!: string;
  public token!: string;
  public expiresAt!: Date;
  public createdByIp!: string;
  public revokedAt?: Date;
  public revokedByIp?: string;
  public replacedByToken?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public isActive(): boolean {
    return !this.revokedAt && !this.isExpired();
  }
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
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdByIp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revokedByIp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    replacedByToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'refresh_tokens',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['token'],
      },
      {
        fields: ['expiresAt'],
      },
    ],
  }
);

User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default RefreshToken;


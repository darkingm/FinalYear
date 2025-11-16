import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';

interface OTPAttributes {
  id: string;
  email: string;
  otp: string;
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'TWO_FACTOR';
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface OTPCreationAttributes extends Optional<OTPAttributes, 'id'> {}

class OTP extends Model<OTPAttributes, OTPCreationAttributes> implements OTPAttributes {
  public id!: string;
  public email!: string;
  public otp!: string;
  public type!: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'TWO_FACTOR';
  public expiresAt!: Date;
  public verified!: boolean;
  public attempts!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public canRetry(): boolean {
    return this.attempts < 3;
  }
}

OTP.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    otp: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'TWO_FACTOR'),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'OTP',
    timestamps: true,
    indexes: [
      {
        fields: ['email', 'type', 'verified'],
      },
      {
        fields: ['expiresAt'],
      },
    ],
  }
);

export default OTP;


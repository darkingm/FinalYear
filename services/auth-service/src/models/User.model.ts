import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
  USER = 'USER',
  SELLER = 'SELLER',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

export enum AuthType {
  LOCAL = 'local',
  SOCIAL = 'social',
  HYBRID = 'hybrid',
}

interface UserAttributes {
  id: string;
  email: string;
  username: string;
  password?: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  authType: AuthType;
  status: UserStatus;
  role: UserRole;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  // Bỏ public class fields để tránh Sequelize warning
  // Sequelize tự động tạo getters/setters từ User.init()
  
  // Chỉ giữ lại methods
  public async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  // Declare getters để TypeScript biết về các attributes
  declare id: string;
  declare email: string;
  declare username: string;
  declare password?: string;
  declare fullName: string;
  declare phone?: string;
  declare avatarUrl?: string;
  declare authType: AuthType;
  declare status: UserStatus;
  declare role: UserRole;
  declare isEmailVerified: boolean;
  declare lastLoginAt?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
      validate: {
        len: [3, 20],
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'full_name',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'avatar_url',
    },
    authType: {
      type: DataTypes.ENUM(...Object.values(AuthType)),
      defaultValue: AuthType.LOCAL,
      field: 'auth_type',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(UserStatus)),
      defaultValue: UserStatus.ACTIVE,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      defaultValue: UserRole.USER,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'email_verified',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
    },
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password') && user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;
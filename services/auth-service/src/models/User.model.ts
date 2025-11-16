import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: string;
  email: string;
  username: string;
  password?: string;
  fullName: string;
  role: 'ADMIN' | 'SUPPORT' | 'USER';
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
  declare role: 'ADMIN' | 'SUPPORT' | 'USER';
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
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'SUPPORT', 'USER'),
      defaultValue: 'USER',
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'Users',
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
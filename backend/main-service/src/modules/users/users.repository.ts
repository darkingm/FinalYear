import { query } from '../../config/database';

export interface UserProfile {
  user_id: number;
  email: string;
  username: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: Date;
}

export const usersRepository = {
  findById: async (userId: number): Promise<UserProfile | null> => {
    const result = await query(
      `SELECT user_id, email, username, wallet_address, avatar_url, role, status, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  updateProfile: async (
    userId: number,
    data: { username?: string; avatar_url?: string; paypal_email?: string }
  ): Promise<UserProfile | null> => {
    const result = await query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           avatar_url = COALESCE($2, avatar_url),
           paypal_email = COALESCE($3, paypal_email),
           updated_at = NOW()
       WHERE user_id = $4
       RETURNING user_id, email, username, wallet_address, avatar_url, role, status, created_at`,
      [data.username, data.avatar_url, data.paypal_email, userId]
    );
    return result.rows[0] || null;
  },
};

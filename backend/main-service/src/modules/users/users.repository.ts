import { query } from '../../config/database';

export interface UserProfile {
  user_id: number;
  email: string;
  phone: string | null;
  address_line: string | null;
  username: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
  paypal_email?: string | null;
  role: string;
  status: string;
  created_at: Date;
}

export const usersRepository = {
  findById: async (userId: number): Promise<UserProfile | null> => {
    const result = await query(
      `SELECT user_id, email, phone, address_line, username, wallet_address, avatar_url, paypal_email, role, status, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  updateProfile: async (
    userId: number,
    data: { username?: string; email?: string; phone?: string; address_line?: string; avatar_url?: string; paypal_email?: string }
  ): Promise<UserProfile | null> => {
    const result = await query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address_line = COALESCE($4, address_line),
           avatar_url = COALESCE($5, avatar_url),
           paypal_email = COALESCE($6, paypal_email),
           updated_at = NOW()
       WHERE user_id = $7
       RETURNING user_id, email, phone, address_line, username, wallet_address, avatar_url, paypal_email, role, status, created_at`,
      [data.username, data.email, data.phone, data.address_line, data.avatar_url, data.paypal_email, userId]
    );
    return result.rows[0] || null;
  },
};

import crypto from 'crypto';

/**
 * Hash token trước khi lưu vào database để bảo mật
 * Tất cả refresh tokens được hash bằng SHA-256 trước khi lưu
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Tính thời gian hết hạn của refresh token dựa trên config
 * @param expiresInString - Chuỗi như '7d', '30d', etc. từ JWT config
 * @returns Date object cho expiresAt
 */
export const calculateExpiresAt = (expiresInString: string): Date => {
  const expiresAt = new Date();
  
  // Parse expiresInString (ví dụ: '7d', '30d', '14d')
  const match = expiresInString.match(/^(\d+)([dhms])$/);
  if (!match) {
    // Default: 7 days nếu không parse được
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd':
      expiresAt.setDate(expiresAt.getDate() + value);
      break;
    case 'h':
      expiresAt.setHours(expiresAt.getHours() + value);
      break;
    case 'm':
      expiresAt.setMinutes(expiresAt.getMinutes() + value);
      break;
    case 's':
      expiresAt.setSeconds(expiresAt.getSeconds() + value);
      break;
    default:
      expiresAt.setDate(expiresAt.getDate() + 7);
  }

  return expiresAt;
};


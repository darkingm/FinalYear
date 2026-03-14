import rateLimit from 'express-rate-limit';

// Skip localhost / Docker internal network to avoid NextAuth → backend 429 loops
const skipLocalNetwork = (req: any) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('172.') ||     // Docker bridge networks
    ip.startsWith('10.')          // Private networks
  );
};

// General API rate limiting — 200 req / 15 min per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalNetwork,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Auth endpoints — 10 attempts / 5 min per IP (login, register, forgot-password)
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalNetwork,         // IMPORTANT: NextAuth calls login server-to-server
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 5 minutes',
  },
});

// Strict limiter — 5 req / 5 min (password reset, etc.)
export const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocalNetwork,
  message: {
    success: false,
    message: 'Too many requests for this action, please try again later',
  },
});

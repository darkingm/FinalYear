import rateLimit from 'express-rate-limit';

/**
 * Detect requests from local/internal network.
 * - NextAuth calls backend server-to-server (Docker internal network, e.g. 172.x.x.x)
 * - Skipping internal IPs prevents NextAuth from getting 429 when relaying user requests
 */
const skipInternalNetwork = (req: any): boolean => {
  // SECURITY: Only trust socket address, not X-Forwarded-For
  // (attackers can spoof X-Forwarded-For to bypass rate limiting)
  const ip = req.socket?.remoteAddress || '';

  return (
    ip === '127.0.0.1'          ||
    ip === '::1'                 ||
    ip === '::ffff:127.0.0.1'   ||
    ip.startsWith('172.')        ||  // Docker bridge networks
    ip.startsWith('10.')         ||  // Private networks (VPS internal)
    ip.startsWith('192.168.')       // LAN
  );
};

/**
 * General API rate limiting — 300 req / 15 min per IP
 * Applies to all endpoints as baseline protection.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInternalNetwork,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

/**
 * Auth endpoint limiter — 30 attempts / 5 min per IP
 * Applied per route: /login, /register, /wallet-login, /forgot-password
 *
 * 30 req / 5 min = 6 per min = reasonable for a real user who may:
 * - Try wrong password a few times
 * - Switch between tabs/devices
 * - Be a developer testing the flow
 *
 * IMPORTANT: NextAuth makes server-to-server calls from the frontend server
 * to this backend. Those calls come from internal Docker IPs (172.x.x.x)
 * and are skipped automatically via skipInternalNetwork.
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInternalNetwork,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 5 minutes',
  },
});

/**
 * Strict limiter — 5 req / 15 min
 * Only for: /reset-password (actual password reset with token)
 * This should be very strict — password reset tokens are sensitive.
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInternalNetwork,
  message: {
    success: false,
    message: 'Too many requests for this action, please try again in 15 minutes',
  },
});

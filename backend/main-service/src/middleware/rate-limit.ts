import rateLimit from 'express-rate-limit';

/**
 * Detect requests from local/internal network.
 * - NextAuth calls backend server-to-server (Docker internal network, e.g. 172.x.x.x)
 * - Skipping internal IPs prevents NextAuth from getting 429 when relaying user requests
 *
 * IMPORTANT: We check BOTH req.ip (real client IP via X-Forwarded-For + trust proxy)
 * AND req.socket.remoteAddress (the connecting socket). If req.ip shows a public IP
 * but the socket is internal, that means nginx is proxying a public request — NOT internal.
 * We only skip if BOTH are internal (genuine server-to-server like NextAuth → backend).
 */
const isInternalIp = (ip: string): boolean => {
  return (
    ip === '127.0.0.1'          ||
    ip === '::1'                 ||
    ip === '::ffff:127.0.0.1'   ||
    ip.startsWith('172.')        ||  // Docker bridge networks
    ip.startsWith('10.')         ||  // Private networks (VPS internal)
    ip.startsWith('192.168.')       // LAN
  );
};

const skipInternalNetwork = (req: any): boolean => {
  // req.ip respects 'trust proxy' = real client IP from X-Forwarded-For
  // req.socket.remoteAddress = immediate connecting IP (nginx/docker)
  const realIp = req.ip || '';
  const socketIp = req.socket?.remoteAddress || '';

  // Only skip if the REAL client IP is also internal
  // This means it's genuine server-to-server (e.g. NextAuth container → backend)
  // Public traffic proxied by nginx will have a public req.ip
  return isInternalIp(realIp) && isInternalIp(socketIp);
};

/**
 * General API rate limiting — 2000 req / 15 min per IP
 * Loose by design: this is a demo / FYP and getting 429s during a live
 * defense is far worse than the marginal abuse protection. Real production
 * would tighten this back to ~300 / 15 min.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInternalNetwork,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

/**
 * Auth endpoint limiter — 200 attempts / 5 min per IP
 * Applied per route: /login, /register, /wallet-login, /forgot-password
 *
 * Why so high? NextAuth fires multiple requests per "single" login from the
 * user's POV (csrf → callback/credentials → session) and React strict-mode
 * + page reloads can multiply that 2-3×. 200 / 5 min = ~40 / min = safe for
 * any reasonable testing pattern, still tight enough that a real brute-force
 * (thousands of attempts per second) is blocked.
 *
 * IMPORTANT: NextAuth makes server-to-server calls from the frontend server
 * to this backend. Those calls come from internal Docker IPs (172.x.x.x)
 * and are skipped automatically via skipInternalNetwork — but ONLY when
 * req.ip is also internal (genuine server-to-server).
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInternalNetwork,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 5 minutes',
  },
});

/**
 * Strict limiter — 30 req / 15 min
 * Only for: /reset-password (actual password reset with token).
 * Higher than the original 5 because demo testers hit it multiple times,
 * but still tight enough that a token-grinding attack is impractical.
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInternalNetwork,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: {
    success: false,
    message: 'Too many requests for this action, please try again in 15 minutes',
  },
});

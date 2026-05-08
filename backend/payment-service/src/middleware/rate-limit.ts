import rateLimit from 'express-rate-limit';

const invoiceLimitMax = Number.parseInt(process.env.PAYMENT_INVOICE_RATE_LIMIT_MAX || '60', 10);

// General API rate limiting — bumped from 100→1500 / 15 min for demo.
// Real production should tighten this back.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter limiter for payment-mutating endpoints — bumped 20→150 / 5 min so
// repeated checkout/cancel attempts during demo don't get blocked.
export const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests for this action, please try again later',
  },
});

// Demo-friendly limiter for creating checkout invoices — default bumped 10→60.
export const invoiceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number.isFinite(invoiceLimitMax) && invoiceLimitMax > 0 ? invoiceLimitMax : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many invoice requests, please try again later',
  },
});

// Relaxed limiter for payment status polling (GET-only reads). Frontend polls
// every 15s; bumped 60→300 / 5 min so multiple open checkout tabs don't share
// the quota and stall each other.
export const statusLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many status checks, please wait a moment',
  },
});

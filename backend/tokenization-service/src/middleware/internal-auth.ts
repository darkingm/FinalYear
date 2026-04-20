import { Request, Response, NextFunction } from 'express';

/**
 * Middleware: Require X-Internal-Service-Key header.
 * Tokenization-service is internal-only — all mutating requests must come
 * from main-service (which handles user auth + role checks).
 */
export function requireInternalKey(req: Request, res: Response, next: NextFunction) {
    const key = req.headers['x-internal-service-key'] as string | undefined;
    const expected = process.env.INTERNAL_SERVICE_KEY;

    if (!expected) {
        console.error('[auth] INTERNAL_SERVICE_KEY not configured — rejecting all mutating requests');
        return res.status(500).json({ error: 'Service misconfigured: missing INTERNAL_SERVICE_KEY' });
    }

    if (!key || key !== expected) {
        return res.status(403).json({ error: 'Forbidden: invalid or missing internal service key' });
    }

    next();
}

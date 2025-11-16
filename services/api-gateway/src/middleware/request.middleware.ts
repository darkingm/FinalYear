import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const handleRequestAbortion = (req: Request, res: Response, next: NextFunction) => {
  // Handle client disconnection
  req.on('close', () => {
    if (!res.headersSent) {
      logger.debug(`Request aborted by client: ${req.method} ${req.url}`);
    }
  });

  next();
};

export const requestSizeValidator = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
    });
  }

  next();
};
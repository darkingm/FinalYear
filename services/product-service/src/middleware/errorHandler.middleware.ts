import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Custom Error Class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Handler Middleware
 * Catches all errors and returns consistent JSON response
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Handle Mongoose errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    const validationErrors = Object.values((err as any).errors || {}).map((e: any) => e.message);
    
    logger.error('Validation error:', validationErrors);
    
    return res.status(statusCode).json({
      success: false,
      error: message,
      details: validationErrors,
    });
  }
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }
  else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    statusCode = 400;
    message = 'Duplicate entry';
  }
  // Handle not found errors
  else if (err.message?.includes('not found')) {
    statusCode = 404;
    message = err.message;
  }
  // Generic error
  else {
    message = err.message || 'Internal server error';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Client error:', {
      error: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Don't leak error details in production
  const errorResponse: any = {
    success: false,
    error: message,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    path: req.path,
  });
};

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

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
  let isOperational = false;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }
  // Handle Sequelize errors
  else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation error';
    const validationErrors = (err as any).errors?.map((e: any) => e.message) || [];
    
    logger.error('Validation error:', validationErrors);
    
    return res.status(statusCode).json({
      success: false,
      error: message,
      details: validationErrors,
    });
  }
  else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    const field = (err as any).errors?.[0]?.path || 'field';
    message = `${field} already exists`;
  }
  else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Invalid reference to related resource';
  }
  else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Database error';
    logger.error('Database error:', err);
  }
  // Handle not found errors
  else if (err.message?.includes('not found')) {
    statusCode = 404;
    message = err.message;
  }
  // Handle insufficient stock/balance
  else if (err.message?.includes('Insufficient') || err.message?.includes('Out of stock')) {
    statusCode = 400;
    message = err.message;
  }
  // Handle invalid order status
  else if (err.message?.includes('Invalid order status') || err.message?.includes('Cannot')) {
    statusCode = 400;
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

/**
 * Create operational error
 */
export const createError = (statusCode: number, message: string) => {
  return new AppError(statusCode, message, true);
};

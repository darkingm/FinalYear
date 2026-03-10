import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './error-handler';

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const zodError = error as any;
        const message = zodError.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        return next(new AppError(`Validation failed: ${message}`, 400));
      }
      return next(error);
    }
  };
};

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
      // Duck-type check: ZodError always has an .issues array.
      // Using instanceof alone can fail when multiple Zod copies exist.
      const issues: any[] = error?.issues ?? error?.errors ?? [];
      if (error instanceof ZodError || issues.length > 0) {
        const message = issues
          .map((e: any) => {
            const path = Array.isArray(e.path) ? e.path.join('.') : String(e.path ?? '');
            return path ? `${path}: ${e.message}` : e.message;
          })
          .join(', ') || 'Validation failed';
        return next(new AppError(`Validation failed: ${message}`, 400));
      }
      return next(error);
    }
  };
};


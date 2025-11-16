import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  logger.info(`Incoming ${req.method} request to ${req.path}`, {
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Log response
  const oldSend = res.send;
  res.send = function (data) {
    logger.info(`Response for ${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      body: data
    });
    return oldSend.apply(res, arguments as any);
  };

  next();
};
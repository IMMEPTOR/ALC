import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });

  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};

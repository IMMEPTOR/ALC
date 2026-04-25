import { Request, Response, NextFunction } from 'express';
import logger from '../logger';
import { recordRequest } from '../metrics';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    recordRequest(req.method, req.originalUrl, res.statusCode, duration);

    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, logData);
    } else {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, logData);
    }
  });

  next();
};

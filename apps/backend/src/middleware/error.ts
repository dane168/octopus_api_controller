import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    logger.warn({ err }, 'Operational error');
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  logger.error({ err }, 'Unexpected error');
  res.status(500).json({
    error: 'Internal server error',
  });
};

import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import logger from '@/utils/logger';

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
    return;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: error.message,
    });
    return;
  }

  if (error.name === 'MulterError') {
    let message = 'File upload error';
    if (error.message.includes('File too large')) {
      message = 'File size exceeds 10MB limit';
    }
    res.status(400).json({
      success: false,
      error: message,
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
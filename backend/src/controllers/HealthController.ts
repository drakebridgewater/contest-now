import { Request, Response } from 'express';
import { database } from '@/models/database';
import { ApiResponse } from '@/types';
import { asyncHandler } from '@/middleware/errorHandler';

export class HealthController {
  public getHealth = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const isDbReady = database.isDbReady();
    const response: ApiResponse = {
      success: isDbReady,
      data: {
        status: isDbReady ? 'ok' : 'error',
        message: isDbReady ? 'Contest API is running' : 'Contest API is running but database is not ready',
        database: isDbReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
    };

    // Return 503 Service Unavailable if database is not ready
    const statusCode = isDbReady ? 200 : 503;
    res.status(statusCode).json(response);
  });
}

export const healthController = new HealthController();
export default healthController;
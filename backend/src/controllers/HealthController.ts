import { Request, Response } from 'express';
import { database } from '@/models/database';
import { ApiResponse } from '@/types';
import { asyncHandler } from '@/middleware/errorHandler';

export class HealthController {
  public getHealth = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'ok',
        message: 'Contest API is running',
        database: database.isDbReady() ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
    };

    res.json(response);
  });
}

export const healthController = new HealthController();
export default healthController;
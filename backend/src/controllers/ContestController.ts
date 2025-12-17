import { Request, Response, NextFunction } from 'express';
import { contestService } from '@/services/ContestService';
import { CreateContestRequest } from '@/types';
import { ValidationError } from '@/utils/errors';
import logger from '@/utils/logger';

export class ContestController {
  public async getAllContests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contests = await contestService.getAllContests();
      res.json({ success: true, data: contests });
    } catch (error) {
      next(error);
    }
  }

  public async getActiveContests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contests = await contestService.getActiveContests();
      res.json({ success: true, data: contests });
    } catch (error) {
      next(error);
    }
  }

  public async getContestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new ValidationError('Contest ID is required');
      }

      // Basic UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new ValidationError('Invalid contest ID format');
      }

      const contest = await contestService.getContestById(id);
      res.json({ success: true, data: contest });
    } catch (error) {
      next(error);
    }
  }

  public async getContestsByEventId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.params.eventId) {
        throw new ValidationError('Event ID is required');
      }
      const eventId = parseInt(req.params.eventId);
      if (isNaN(eventId)) {
        throw new ValidationError('Invalid event ID');
      }

      const contests = await contestService.getContestsByEventId(eventId);
      res.json({ success: true, data: contests });
    } catch (error) {
      next(error);
    }
  }

  public async createContest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contestData: CreateContestRequest = req.body;

      // Validate required fields
      if (!contestData.event_id || !contestData.contest_name || !contestData.contest_type) {
        throw new ValidationError('Event ID, contest name, and contest type are required');
      }

      const validTypes = ['dessert', 'cocktail', 'appetizer', 'sweater', 'other'];
      if (!validTypes.includes(contestData.contest_type)) {
        throw new ValidationError('Invalid contest type');
      }

      const contest = await contestService.createContest(contestData);
      logger.info(`Contest created: ${contest.contest_name}`);
      res.status(201).json({ success: true, data: contest });
    } catch (error) {
      next(error);
    }
  }

  public async updateContest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.params.id) {
        throw new ValidationError('Contest ID is required');
      }
      const id = req.params.id;

      const contestData: Partial<CreateContestRequest> = req.body;

      // Validate contest type if provided
      if (contestData.contest_type) {
        const validTypes = ['dessert', 'cocktail', 'appetizer', 'sweater', 'other'];
        if (!validTypes.includes(contestData.contest_type)) {
          throw new ValidationError('Invalid contest type');
        }
      }

      const contest = await contestService.updateContest(id, contestData);
      logger.info(`Contest updated: ${contest.contest_name}`);
      res.json({ success: true, data: contest });
    } catch (error) {
      next(error);
    }
  }

  public async deleteContest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.params.id) {
        throw new ValidationError('Contest ID is required');
      }
      const id = req.params.id;

      await contestService.deleteContest(id);
      logger.info(`Contest deleted: ID ${id}`);
      res.json({ success: true, message: 'Contest deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const contestController = new ContestController();
export default contestController;

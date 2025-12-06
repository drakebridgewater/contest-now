import { Request, Response, NextFunction } from 'express';
import { eventService } from '@/services/EventService';
import { CreateEventRequest } from '@/types';
import { ValidationError } from '@/utils/errors';
import logger from '@/utils/logger';

export class EventController {
  public async getAllEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const events = await eventService.getAllEvents();
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }

  public async getActiveEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const events = await eventService.getActiveEvents();
      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }

  public async getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.params.id) {
        throw new ValidationError('Event ID is required');
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError('Invalid event ID');
      }

      const event = await eventService.getEventById(id);
      res.json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  public async createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventData: CreateEventRequest = req.body;

      // Validate required fields
      if (!eventData.event_name || !eventData.event_date) {
        throw new ValidationError('Event name and date are required');
      }

      const event = await eventService.createEvent(eventData);
      logger.info(`Event created: ${event.event_name}`);
      res.status(201).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  public async updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.params.id) {
        throw new ValidationError('Event ID is required');
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError('Invalid event ID');
      }

      const eventData: Partial<CreateEventRequest> = req.body;
      const event = await eventService.updateEvent(id, eventData);
      logger.info(`Event updated: ${event.event_name}`);
      res.json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  public async deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.params.id) {
        throw new ValidationError('Event ID is required');
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError('Invalid event ID');
      }

      await eventService.deleteEvent(id);
      logger.info(`Event deleted: ID ${id}`);
      res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
export default eventController;

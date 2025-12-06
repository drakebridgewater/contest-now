import { database } from './database';
import { Event, CreateEventRequest } from '@/types';
import { NotFoundError, InternalServerError } from '@/utils/errors';
import logger from '@/utils/logger';

export class EventModel {
  public async findAll(): Promise<Event[]> {
    try {
      return await database.all<Event>('SELECT * FROM events ORDER BY event_date DESC, created_at DESC');
    } catch (error) {
      logger.error('Error fetching events:', error);
      throw new InternalServerError('Failed to fetch events');
    }
  }

  public async findById(id: number): Promise<Event> {
    try {
      const event = await database.get<Event>('SELECT * FROM events WHERE id = ?', [id]);
      if (!event) {
        throw new NotFoundError(`Event with id ${id} not found`);
      }
      return event;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error fetching event:', error);
      throw new InternalServerError('Failed to fetch event');
    }
  }

  public async findActive(): Promise<Event[]> {
    try {
      return await database.all<Event>(
        'SELECT * FROM events WHERE is_active = 1 ORDER BY event_date DESC, created_at DESC'
      );
    } catch (error) {
      logger.error('Error fetching active events:', error);
      throw new InternalServerError('Failed to fetch active events');
    }
  }

  public async create(eventData: CreateEventRequest): Promise<Event> {
    try {
      const result = await database.run(
        `INSERT INTO events (event_name, event_date, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [
          eventData.event_name,
          eventData.event_date,
          eventData.description || null,
          eventData.is_active !== undefined ? (eventData.is_active ? 1 : 0) : 1,
        ]
      );

      const event = await this.findById(result.lastID);
      logger.info(`Created event: ${event.event_name} (ID: ${event.id})`);
      return event;
    } catch (error) {
      logger.error('Error creating event:', error);
      throw new InternalServerError('Failed to create event');
    }
  }

  public async update(id: number, eventData: Partial<CreateEventRequest>): Promise<Event> {
    try {
      // First check if event exists
      await this.findById(id);

      const updates: string[] = [];
      const values: unknown[] = [];

      if (eventData.event_name !== undefined) {
        updates.push('event_name = ?');
        values.push(eventData.event_name);
      }
      if (eventData.event_date !== undefined) {
        updates.push('event_date = ?');
        values.push(eventData.event_date);
      }
      if (eventData.description !== undefined) {
        updates.push('description = ?');
        values.push(eventData.description);
      }
      if (eventData.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(eventData.is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      await database.run(
        `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const event = await this.findById(id);
      logger.info(`Updated event: ${event.event_name} (ID: ${event.id})`);
      return event;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error updating event:', error);
      throw new InternalServerError('Failed to update event');
    }
  }

  public async delete(id: number): Promise<void> {
    try {
      const event = await this.findById(id);
      await database.run('DELETE FROM events WHERE id = ?', [id]);
      logger.info(`Deleted event: ${event.event_name} (ID: ${event.id})`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error deleting event:', error);
      throw new InternalServerError('Failed to delete event');
    }
  }
}

export const eventModel = new EventModel();
export default eventModel;

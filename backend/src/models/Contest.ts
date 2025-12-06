import { database } from './database';
import { Contest, ContestWithEvent, CreateContestRequest, ContestType } from '@/types';
import { NotFoundError, InternalServerError } from '@/utils/errors';
import logger from '@/utils/logger';

export class ContestModel {
  private generateUUID(): string {
    // Simple UUID v4 generation for SQLite compatibility
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  public async findAll(): Promise<ContestWithEvent[]> {
    try {
      return await database.all<ContestWithEvent>(
        `SELECT c.*, e.event_name, e.event_date 
         FROM contests c
         JOIN events e ON c.event_id = e.id
         ORDER BY e.event_date DESC, c.created_at DESC`
      );
    } catch (error) {
      logger.error('Error fetching contests:', error);
      throw new InternalServerError('Failed to fetch contests');
    }
  }

  public async findById(id: string): Promise<ContestWithEvent> {
    try {
      const contest = await database.get<ContestWithEvent>(
        `SELECT c.*, e.event_name, e.event_date 
         FROM contests c
         JOIN events e ON c.event_id = e.id
         WHERE c.id = ?`,
        [id]
      );
      if (!contest) {
        throw new NotFoundError(`Contest with id ${id} not found`);
      }
      return contest;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error fetching contest:', error);
      throw new InternalServerError('Failed to fetch contest');
    }
  }

  public async findByEventId(eventId: number): Promise<ContestWithEvent[]> {
    try {
      return await database.all<ContestWithEvent>(
        `SELECT c.*, e.event_name, e.event_date 
         FROM contests c
         JOIN events e ON c.event_id = e.id
         WHERE c.event_id = ?
         ORDER BY c.created_at DESC`,
        [eventId]
      );
    } catch (error) {
      logger.error('Error fetching contests by event:', error);
      throw new InternalServerError('Failed to fetch contests');
    }
  }

  public async findActive(): Promise<ContestWithEvent[]> {
    try {
      return await database.all<ContestWithEvent>(
        `SELECT c.*, e.event_name, e.event_date 
         FROM contests c
         JOIN events e ON c.event_id = e.id
         WHERE c.is_active = 1 AND e.is_active = 1
         ORDER BY e.event_date DESC, c.created_at DESC`
      );
    } catch (error) {
      logger.error('Error fetching active contests:', error);
      throw new InternalServerError('Failed to fetch active contests');
    }
  }

  public async create(contestData: CreateContestRequest): Promise<ContestWithEvent> {
    try {
      // Generate UUID for the new contest
      const contestId = this.generateUUID();

      await database.run(
        `INSERT INTO contests (id, event_id, contest_name, contest_type, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          contestId,
          contestData.event_id,
          contestData.contest_name,
          contestData.contest_type,
          contestData.description || null,
          contestData.is_active !== undefined ? (contestData.is_active ? 1 : 0) : 1,
        ]
      );

      const contest = await this.findById(contestId);
      logger.info(`Created contest: ${contest.contest_name} (ID: ${contest.id})`);
      return contest;
    } catch (error) {
      logger.error('Error creating contest:', error);
      throw new InternalServerError('Failed to create contest');
    }
  }

  public async update(id: string, contestData: Partial<CreateContestRequest>): Promise<ContestWithEvent> {
    try {
      // First check if contest exists
      await this.findById(id);

      const updates: string[] = [];
      const values: unknown[] = [];

      if (contestData.event_id !== undefined) {
        updates.push('event_id = ?');
        values.push(contestData.event_id);
      }
      if (contestData.contest_name !== undefined) {
        updates.push('contest_name = ?');
        values.push(contestData.contest_name);
      }
      if (contestData.contest_type !== undefined) {
        updates.push('contest_type = ?');
        values.push(contestData.contest_type);
      }
      if (contestData.description !== undefined) {
        updates.push('description = ?');
        values.push(contestData.description);
      }
      if (contestData.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(contestData.is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      await database.run(
        `UPDATE contests SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const contest = await this.findById(id);
      logger.info(`Updated contest: ${contest.contest_name} (ID: ${contest.id})`);
      return contest;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error updating contest:', error);
      throw new InternalServerError('Failed to update contest');
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      const contest = await this.findById(id);
      await database.run('DELETE FROM contests WHERE id = ?', [id]);
      logger.info(`Deleted contest: ${contest.contest_name} (ID: ${contest.id})`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error deleting contest:', error);
      throw new InternalServerError('Failed to delete contest');
    }
  }
}

export const contestModel = new ContestModel();
export default contestModel;

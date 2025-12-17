import { database } from './database';
import { Entry, EntryWithPhoto, CreateEntryRequest, EntryResult, ContestType } from '@/types';
import { NotFoundError, InternalServerError } from '@/utils/errors';
import logger from '@/utils/logger';
import { config } from '@/config';

interface EntryResultRow {
  id: number;
  contest_id: string;
  entry_name: string;
  contestant_name: string;
  photo_path: string;
  allergens: string;
  created_at: string;
  contest_type: ContestType;
  contest_name: string;
  event_id: number;
  event_name: string;
  vote_count: number;
  avg_appearance: number;
  avg_texture: number;
  avg_flavor: number;
  average_rating: number;
  comments_concat: string | null;
  appearance_1_count: number;
  appearance_2_count: number;
  appearance_3_count: number;
  appearance_4_count: number;
  appearance_5_count: number;
  texture_1_count: number;
  texture_2_count: number;
  texture_3_count: number;
  texture_4_count: number;
  texture_5_count: number;
  flavor_1_count: number;
  flavor_2_count: number;
  flavor_3_count: number;
  flavor_4_count: number;
  flavor_5_count: number;
}

export class EntryModel {
  public async findAll(contestId?: string): Promise<EntryWithPhoto[]> {
    try {
      let query = `
        SELECT e.*, c.contest_type, c.contest_name, c.event_id, ev.event_name
        FROM entries e
        JOIN contests c ON e.contest_id = c.id
        JOIN events ev ON c.event_id = ev.id
      `;
      const params: unknown[] = [];

      if (contestId !== undefined) {
        query += ' WHERE e.contest_id = ?';
        params.push(contestId);
      }

      query += ' ORDER BY e.created_at DESC';

      const entries = await database.all<Entry & { contest_type: ContestType; contest_name: string; event_id: number; event_name: string }>(query, params);

      return entries.map(entry => ({
        ...entry,
        photo: `${config.server.baseUrl}/uploads/${entry.photo_path}`,
        allergens: entry.allergens ? JSON.parse(entry.allergens) : [],
      }));
    } catch (error) {
      logger.error('Error fetching entries:', error);
      throw new InternalServerError('Failed to fetch entries');
    }
  }

  public async findById(id: number): Promise<Entry | null> {
    try {
      const entry = await database.get<Entry>('SELECT * FROM entries WHERE id = ?', [id]);
      return entry || null;
    } catch (error) {
      logger.error('Error fetching entry by ID:', error);
      throw new InternalServerError('Failed to fetch entry');
    }
  }

  public async create(entryData: CreateEntryRequest, photoFileName: string): Promise<EntryWithPhoto> {
    try {
      const allergensJson = entryData.allergens ? JSON.stringify(entryData.allergens) : '[]';

      // Get contest info first to get the contest_type (required for insert)
      const contestInfo = await database.get<{ contest_type: ContestType; contest_name: string; event_id: number; event_name: string }>(
        `SELECT c.contest_type, c.contest_name, c.event_id, ev.event_name
         FROM contests c
         JOIN events ev ON c.event_id = ev.id
         WHERE c.id = ?`,
        [entryData.contest_id]
      );

      if (!contestInfo) {
        logger.error('Contest not found:', entryData.contest_id);
        throw new InternalServerError('Contest not found');
      }

      const result = await database.run(
        'INSERT INTO entries (contest_id, entry_name, contestant_name, photo_path, allergens, contest_type) VALUES (?, ?, ?, ?, ?, ?)',
        [entryData.contest_id, entryData.entry_name, entryData.contestant_name, photoFileName, allergensJson, contestInfo.contest_type]
      );

      if (!result.lastID) {
        logger.error('No lastID returned after entry creation');
        throw new InternalServerError('Failed to create entry');
      }

      return {
        id: result.lastID,
        contest_id: entryData.contest_id,
        entry_name: entryData.entry_name,
        contestant_name: entryData.contestant_name,
        photo_path: photoFileName,
        photo: `${config.server.baseUrl}/uploads/${photoFileName}`,
        allergens: entryData.allergens || [],
        created_at: new Date().toISOString(),
        contest_type: contestInfo.contest_type,
        contest_name: contestInfo.contest_name,
        event_id: contestInfo.event_id,
        event_name: contestInfo.event_name,
      };
    } catch (error) {
      logger.error('Error creating entry:', error);
      throw new InternalServerError('Failed to create entry');
    }
  }

  public async delete(id: number): Promise<Entry> {
    try {
      // First get the entry to return it and get the photo path
      const entry = await this.findById(id);
      if (!entry) {
        logger.error(`Entry with ID ${id} not found for deletion`);
        throw new NotFoundError('Entry not found');
      }

      // Delete associated votes first
      await database.run('DELETE FROM votes WHERE entry_id = ?', [id]);

      // Delete the entry
      const result = await database.run('DELETE FROM entries WHERE id = ?', [id]);

      if (result.changes === 0) {
        logger.error(`No rows affected when deleting entry ${id}`);
        throw new NotFoundError('Entry not found');
      }

      return entry;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof InternalServerError) {
        throw error;
      }
      logger.error('Error deleting entry:', error);
      throw new InternalServerError('Failed to delete entry');
    }
  }

  public async getResults(contestId?: string): Promise<EntryResult[]> {
    try {
      let query = `
        SELECT
          e.*,
          c.contest_type,
          c.contest_name,
          c.event_id,
          ev.event_name,
          COUNT(v.id) as vote_count,
          COALESCE(AVG(CAST(v.appearance_rating AS REAL)), 0) as avg_appearance,
          COALESCE(AVG(CAST(v.texture_rating AS REAL)), 0) as avg_texture,
          COALESCE(AVG(CAST(v.flavor_rating AS REAL)), 0) as avg_flavor,
          COALESCE(AVG(CAST((v.appearance_rating + v.texture_rating + v.flavor_rating) AS REAL) / 3), 0) as average_rating,
          GROUP_CONCAT(
            CASE WHEN v.comment IS NOT NULL AND v.comment != ''
            THEN v.voter_name || ':' || v.comment
            END, '||'
          ) as comments_concat,
          SUM(CASE WHEN v.appearance_rating = 1 THEN 1 ELSE 0 END) as appearance_1_count,
          SUM(CASE WHEN v.appearance_rating = 2 THEN 1 ELSE 0 END) as appearance_2_count,
          SUM(CASE WHEN v.appearance_rating = 3 THEN 1 ELSE 0 END) as appearance_3_count,
          SUM(CASE WHEN v.appearance_rating = 4 THEN 1 ELSE 0 END) as appearance_4_count,
          SUM(CASE WHEN v.appearance_rating = 5 THEN 1 ELSE 0 END) as appearance_5_count,
          SUM(CASE WHEN v.texture_rating = 1 THEN 1 ELSE 0 END) as texture_1_count,
          SUM(CASE WHEN v.texture_rating = 2 THEN 1 ELSE 0 END) as texture_2_count,
          SUM(CASE WHEN v.texture_rating = 3 THEN 1 ELSE 0 END) as texture_3_count,
          SUM(CASE WHEN v.texture_rating = 4 THEN 1 ELSE 0 END) as texture_4_count,
          SUM(CASE WHEN v.texture_rating = 5 THEN 1 ELSE 0 END) as texture_5_count,
          SUM(CASE WHEN v.flavor_rating = 1 THEN 1 ELSE 0 END) as flavor_1_count,
          SUM(CASE WHEN v.flavor_rating = 2 THEN 1 ELSE 0 END) as flavor_2_count,
          SUM(CASE WHEN v.flavor_rating = 3 THEN 1 ELSE 0 END) as flavor_3_count,
          SUM(CASE WHEN v.flavor_rating = 4 THEN 1 ELSE 0 END) as flavor_4_count,
          SUM(CASE WHEN v.flavor_rating = 5 THEN 1 ELSE 0 END) as flavor_5_count
        FROM entries e
        JOIN contests c ON e.contest_id = c.id
        JOIN events ev ON c.event_id = ev.id
        LEFT JOIN votes v ON e.id = v.entry_id
      `;
      
      const params: unknown[] = [];
      if (contestId !== undefined) {
        query += ' WHERE e.contest_id = ?';
        params.push(contestId);
      }

      query += ' GROUP BY e.id, e.entry_name, e.contestant_name, e.contest_id, e.photo_path, e.allergens, e.created_at, c.contest_type, c.contest_name, c.event_id, ev.event_name';
      query += ' ORDER BY c.contest_type, average_rating DESC, vote_count DESC';

      const results = await database.all<EntryResultRow>(query, params);

      return results.map((row: EntryResultRow) => {
        // Parse comments
        const comments: Array<{ voter_name: string; comment: string }> = [];
        if (row.comments_concat) {
          const commentPairs = row.comments_concat.split('||');
          commentPairs.forEach((pair: string) => {
            if (pair) {
              const [voter_name, comment] = pair.split(':', 2);
              if (voter_name && comment) {
                comments.push({ voter_name, comment });
              }
            }
          });
        }

        return {
          id: row.id,
          contest_id: row.contest_id,
          entry_name: row.entry_name,
          contestant_name: row.contestant_name,
          photo_path: row.photo_path,
          photo: `${config.server.baseUrl}/uploads/${row.photo_path}`,
          allergens: row.allergens ? JSON.parse(row.allergens) : [],
          created_at: row.created_at,
          contest_type: row.contest_type,
          contest_name: row.contest_name,
          event_id: row.event_id,
          event_name: row.event_name,
          vote_count: row.vote_count || 0,
          average_rating: row.average_rating || 0,
          avg_appearance: row.avg_appearance || 0,
          avg_texture: row.avg_texture || 0,
          avg_flavor: row.avg_flavor || 0,
          appearance_distribution: {
            1: row.appearance_1_count || 0,
            2: row.appearance_2_count || 0,
            3: row.appearance_3_count || 0,
            4: row.appearance_4_count || 0,
            5: row.appearance_5_count || 0,
          },
          texture_distribution: {
            1: row.texture_1_count || 0,
            2: row.texture_2_count || 0,
            3: row.texture_3_count || 0,
            4: row.texture_4_count || 0,
            5: row.texture_5_count || 0,
          },
          flavor_distribution: {
            1: row.flavor_1_count || 0,
            2: row.flavor_2_count || 0,
            3: row.flavor_3_count || 0,
            4: row.flavor_4_count || 0,
            5: row.flavor_5_count || 0,
          },
          comments,
        };
      });
    } catch (error) {
      logger.error('Error fetching results:', error);
      throw new InternalServerError('Failed to fetch results');
    }
  }
}

export const entryModel = new EntryModel();
export default entryModel;
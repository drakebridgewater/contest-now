import { database } from './database';
import { RankingVote, CreateRankingVoteRequest, RankingVotesByVoter } from '@/types';
import { NotFoundError, InternalServerError } from '@/utils/errors';
import logger from '@/utils/logger';

export class RankingVoteModel {
  public async findByVoter(voterName: string): Promise<RankingVotesByVoter> {
    try {
      const votes = await database.all<RankingVote>(
        'SELECT * FROM ranking_votes WHERE voter_name = ?',
        [voterName]
      );

      const votesByEntry: RankingVotesByVoter = {};
      for (const vote of votes) {
        votesByEntry[vote.entry_id.toString()] = {
          rank: vote.rank,
        };
      }

      return votesByEntry;
    } catch (error) {
      logger.error('Error fetching ranking votes by voter:', error);
      throw new InternalServerError('Failed to fetch ranking votes');
    }
  }

  public async createOrUpdate(voteData: CreateRankingVoteRequest): Promise<RankingVote> {
    try {
      await database.run(
        `INSERT INTO ranking_votes (voter_name, entry_id, rank, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(voter_name, entry_id)
         DO UPDATE SET
           rank = ?,
           updated_at = CURRENT_TIMESTAMP`,
        [
          voteData.voter_name,
          voteData.entry_id,
          voteData.rank,
          voteData.rank,
        ]
      );

      // Fetch the created/updated vote
      const vote = await database.get<RankingVote>(
        'SELECT * FROM ranking_votes WHERE voter_name = ? AND entry_id = ?',
        [voteData.voter_name, voteData.entry_id]
      );

      if (!vote) {
        logger.error('Ranking vote not found after creation/update');
        throw new InternalServerError('Failed to retrieve ranking vote after creation');
      }

      return vote;
    } catch (error) {
      logger.error('Error creating/updating ranking vote:', error);
      throw new InternalServerError('Failed to submit ranking vote');
    }
  }

  public async deleteVote(voterName: string, entryId: number): Promise<void> {
    try {
      await database.run(
        'DELETE FROM ranking_votes WHERE voter_name = ? AND entry_id = ?',
        [voterName, entryId]
      );
    } catch (error) {
      logger.error('Error deleting ranking vote:', error);
      throw new InternalServerError('Failed to delete ranking vote');
    }
  }

  public async findAll(): Promise<RankingVote[]> {
    try {
      return await database.all<RankingVote>('SELECT * FROM ranking_votes ORDER BY entry_id, rank');
    } catch (error) {
      logger.error('Error fetching all ranking votes:', error);
      throw new InternalServerError('Failed to fetch ranking votes');
    }
  }

  public async deleteVoter(voterName: string): Promise<number> {
    try {
      // First check if voter exists
      const voteCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM ranking_votes WHERE voter_name = ?',
        [voterName]
      );

      if (!voteCount || voteCount.count === 0) {
        logger.error(`Voter '${voterName}' not found for deletion`);
        throw new NotFoundError('Voter not found');
      }

      // Delete all ranking votes for this voter
      const result = await database.run('DELETE FROM ranking_votes WHERE voter_name = ?', [voterName]);

      return result.changes || 0;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error deleting voter:', error);
      throw new InternalServerError('Failed to delete voter');
    }
  }

  public async deleteAllForVoter(voterName: string): Promise<number> {
    try {
      // Delete all ranking votes for this voter (without checking if they exist first)
      // This is useful when replacing all votes for a voter
      const result = await database.run('DELETE FROM ranking_votes WHERE voter_name = ?', [voterName]);
      return result.changes || 0;
    } catch (error) {
      logger.error('Error deleting all rankings for voter:', error);
      throw new InternalServerError('Failed to delete all rankings for voter');
    }
  }
}

export const rankingVoteModel = new RankingVoteModel();
export default rankingVoteModel;


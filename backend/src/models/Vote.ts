import { database } from './database';
import { Vote, CreateVoteRequest, VotesByVoter, VoterInfo } from '@/types';
import { NotFoundError, InternalServerError } from '@/utils/errors';
import logger from '@/utils/logger';
import { normalizeVoterName } from '@/utils/validation';

export class VoteModel {
  public async findByVoter(voterName: string): Promise<VotesByVoter> {
    try {
      const votes = await database.all<Vote>(
        'SELECT * FROM votes WHERE voter_name = ?',
        [voterName]
      );

      const votesByEntry: VotesByVoter = {};
      for (const vote of votes) {
        votesByEntry[vote.entry_id.toString()] = {
          appearance_rating: vote.appearance_rating,
          texture_rating: vote.texture_rating,
          flavor_rating: vote.flavor_rating,
          comment: vote.comment || '',
        };
      }

      return votesByEntry;
    } catch (error) {
      logger.error('Error fetching votes by voter:', error);
      throw new InternalServerError('Failed to fetch votes');
    }
  }

  public async createOrUpdate(voteData: CreateVoteRequest): Promise<Vote> {
    try {
      await database.run(
        `INSERT INTO votes (voter_name, entry_id, appearance_rating, texture_rating, flavor_rating, comment, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(voter_name, entry_id)
         DO UPDATE SET
           appearance_rating = ?,
           texture_rating = ?,
           flavor_rating = ?,
           comment = ?,
           updated_at = CURRENT_TIMESTAMP`,
        [
          voteData.voter_name,
          voteData.entry_id,
          voteData.appearance_rating,
          voteData.texture_rating,
          voteData.flavor_rating,
          voteData.comment || '',
          voteData.appearance_rating,
          voteData.texture_rating,
          voteData.flavor_rating,
          voteData.comment || '',
        ]
      );

      // Fetch the created/updated vote
      const vote = await database.get<Vote>(
        'SELECT * FROM votes WHERE voter_name = ? AND entry_id = ?',
        [voteData.voter_name, voteData.entry_id]
      );

      if (!vote) {
        logger.error('Vote not found after creation/update');
        throw new InternalServerError('Failed to retrieve vote after creation');
      }

      return vote;
    } catch (error) {
      logger.error('Error creating/updating vote:', error);
      throw new InternalServerError('Failed to submit vote');
    }
  }

  public async findAll(): Promise<Vote[]> {
    try {
      return await database.all<Vote>('SELECT * FROM votes ORDER BY entry_id, voter_name');
    } catch (error) {
      logger.error('Error fetching all votes:', error);
      throw new InternalServerError('Failed to fetch votes');
    }
  }

  public async getVoters(): Promise<VoterInfo[]> {
    try {
      // Combine voters from both votes and ranking_votes tables
      const query = `
        SELECT
          voter_name,
          SUM(vote_count) as vote_count,
          MIN(first_vote) as first_vote,
          MAX(last_vote) as last_vote
        FROM (
          SELECT
            voter_name,
            COUNT(*) as vote_count,
            MIN(created_at) as first_vote,
            MAX(updated_at) as last_vote
          FROM votes
          GROUP BY voter_name
          
          UNION ALL
          
          SELECT
            voter_name,
            COUNT(*) as vote_count,
            MIN(created_at) as first_vote,
            MAX(updated_at) as last_vote
          FROM ranking_votes
          GROUP BY voter_name
        ) combined_votes
        GROUP BY voter_name
        ORDER BY voter_name
      `;

      return await database.all<VoterInfo>(query);
    } catch (error) {
      logger.error('Error fetching voters:', error);
      throw new InternalServerError('Failed to fetch voters');
    }
  }

  public async updateVoterName(oldVoterName: string, newVoterName: string): Promise<number> {
    try {
      const normalizedOldName = normalizeVoterName(oldVoterName);
      const normalizedNewName = normalizeVoterName(newVoterName);

      // Check if old voter exists in either table
      const traditionalVoteCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM votes WHERE voter_name = ?',
        [normalizedOldName]
      );
      const rankingVoteCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM ranking_votes WHERE voter_name = ?',
        [normalizedOldName]
      );

      const totalVotes = (traditionalVoteCount?.count || 0) + (rankingVoteCount?.count || 0);

      if (totalVotes === 0) {
        logger.error(`Voter '${normalizedOldName}' not found for update`);
        throw new NotFoundError('Voter not found');
      }

      // Check if new voter name already exists in either table
      const existingTraditionalCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM votes WHERE voter_name = ?',
        [normalizedNewName]
      );
      const existingRankingCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM ranking_votes WHERE voter_name = ?',
        [normalizedNewName]
      );

      if ((existingTraditionalCount?.count || 0) + (existingRankingCount?.count || 0) > 0) {
        throw new Error('A voter with that name already exists');
      }

      // Update all votes for this voter in both tables
      const traditionalResult = await database.run(
        'UPDATE votes SET voter_name = ?, updated_at = CURRENT_TIMESTAMP WHERE voter_name = ?',
        [normalizedNewName, normalizedOldName]
      );
      const rankingResult = await database.run(
        'UPDATE ranking_votes SET voter_name = ?, updated_at = CURRENT_TIMESTAMP WHERE voter_name = ?',
        [normalizedNewName, normalizedOldName]
      );

      return (traditionalResult.changes || 0) + (rankingResult.changes || 0);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error updating voter name:', error);
      throw new InternalServerError('Failed to update voter name');
    }
  }

  public async deleteVoter(voterName: string): Promise<number> {
    try {
      // Check if voter exists in either table
      const traditionalVoteCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM votes WHERE voter_name = ?',
        [voterName]
      );
      const rankingVoteCount = await database.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM ranking_votes WHERE voter_name = ?',
        [voterName]
      );

      const totalVotes = (traditionalVoteCount?.count || 0) + (rankingVoteCount?.count || 0);

      if (totalVotes === 0) {
        logger.error(`Voter '${voterName}' not found for deletion`);
        throw new NotFoundError('Voter not found');
      }

      // Delete all votes for this voter from both tables
      const traditionalResult = await database.run('DELETE FROM votes WHERE voter_name = ?', [voterName]);
      const rankingResult = await database.run('DELETE FROM ranking_votes WHERE voter_name = ?', [voterName]);

      return (traditionalResult.changes || 0) + (rankingResult.changes || 0);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error deleting voter:', error);
      throw new InternalServerError('Failed to delete voter');
    }
  }
}

export const voteModel = new VoteModel();
export default voteModel;

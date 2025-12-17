import { Request, Response, NextFunction } from 'express';
import { rankingVoteModel } from '@/models/RankingVote';
import { CreateRankingVoteRequest } from '@/types';
import { ValidationError } from '@/utils/errors';
import logger from '@/utils/logger';

export class RankingVoteController {
  public async getByVoter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { voterName } = req.params;

      if (!voterName) {
        throw new ValidationError('Voter name is required');
      }

      const votes = await rankingVoteModel.findByVoter(voterName);
      res.json({ success: true, data: votes });
    } catch (error) {
      next(error);
    }
  }

  public async submitVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const voteData: CreateRankingVoteRequest = req.body;

      // Validate required fields
      if (!voteData.voter_name) {
        throw new ValidationError('Voter name is required');
      }

      if (!voteData.entry_id) {
        throw new ValidationError('Entry ID is required');
      }

      if (!voteData.rank || voteData.rank < 1 || voteData.rank > 5) {
        throw new ValidationError('Rank must be between 1 and 5');
      }

      const vote = await rankingVoteModel.createOrUpdate(voteData);
      logger.info(`Ranking vote submitted: ${voteData.voter_name} ranked entry ${voteData.entry_id} as #${voteData.rank}`);

      res.json({ success: true, data: vote });
    } catch (error) {
      next(error);
    }
  }

  public async deleteVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { voterName, entryId } = req.params;

      if (!voterName) {
        throw new ValidationError('Voter name is required');
      }

      if (!entryId) {
        throw new ValidationError('Entry ID is required');
      }

      await rankingVoteModel.deleteVote(voterName, parseInt(entryId));
      logger.info(`Ranking vote deleted: ${voterName} for entry ${entryId}`);

      res.json({ success: true, message: 'Ranking vote deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  public async getAllVotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const votes = await rankingVoteModel.findAll();
      res.json({ success: true, data: votes });
    } catch (error) {
      next(error);
    }
  }

  public async deleteAllForVoter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { voterName } = req.params;

      if (!voterName) {
        throw new ValidationError('Voter name is required');
      }

      const deletedCount = await rankingVoteModel.deleteAllForVoter(voterName);
      logger.info(`All ranking votes deleted for voter: ${voterName} (${deletedCount} votes)`);

      res.json({ success: true, message: `Deleted ${deletedCount} ranking votes`, data: { deletedCount } });
    } catch (error) {
      next(error);
    }
  }

  public async submitAllRankings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { voter_name, rankings } = req.body as { voter_name: string; rankings: Array<{ entry_id: number; rank: number }> };

      if (!voter_name) {
        throw new ValidationError('Voter name is required');
      }

      if (!rankings || !Array.isArray(rankings) || rankings.length !== 5) {
        throw new ValidationError('Exactly 5 rankings are required');
      }

      // Validate each ranking
      for (const ranking of rankings) {
        if (!ranking.entry_id || !ranking.rank || ranking.rank < 1 || ranking.rank > 5) {
          throw new ValidationError('Each ranking must have a valid entry_id and rank (1-5)');
        }
      }

      // Delete all existing rankings for this voter first
      await rankingVoteModel.deleteAllForVoter(voter_name);

      // Submit all new rankings
      const submittedVotes = await Promise.all(
        rankings.map((ranking) =>
          rankingVoteModel.createOrUpdate({
            voter_name,
            entry_id: ranking.entry_id,
            rank: ranking.rank,
          })
        )
      );

      logger.info(`All rankings submitted for voter: ${voter_name}`);

      res.json({ success: true, data: submittedVotes });
    } catch (error) {
      next(error);
    }
  }
}

export const rankingVoteController = new RankingVoteController();
export default rankingVoteController;


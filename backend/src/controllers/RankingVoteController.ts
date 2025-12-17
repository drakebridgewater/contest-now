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
}

export const rankingVoteController = new RankingVoteController();
export default rankingVoteController;


import { Request, Response } from 'express';
import { voteService } from '@/services/VoteService';
import { validateVote, validateVoterName } from '@/utils/validation';
import { ApiResponse } from '@/types';
import { asyncHandler } from '@/middleware/errorHandler';

export class VoteController {
  public getVotesByVoter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const voterName = validateVoterName(req.params.voterName);
    const votes = await voteService.getVotesByVoter(voterName);

    const response: ApiResponse = {
      success: true,
      data: votes,
    };

    res.json(response);
  });

  public submitVote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validatedData = validateVote(req.body);
    const vote = await voteService.submitVote(validatedData);

    const response: ApiResponse = {
      success: true,
      data: vote,
      message: 'Vote submitted successfully',
    };

    res.json(response);
  });

  public getAllVotes = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const votes = await voteService.getAllVotes();

    const response: ApiResponse = {
      success: true,
      data: votes,
    };

    res.json(response);
  });

  public getAllVoters = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const voters = await voteService.getAllVoters();

    const response: ApiResponse = {
      success: true,
      data: voters,
    };

    res.json(response);
  });

  public deleteVoter = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const voterName = validateVoterName(req.params.voterName);
    const deletedCount = await voteService.deleteVoter(voterName);

    const response: ApiResponse = {
      success: true,
      data: {
        deletedVoter: voterName,
        deletedVotes: deletedCount,
      },
      message: `Voter "${voterName}" and all their votes deleted successfully`,
    };

    res.json(response);
  });
}

export const voteController = new VoteController();
export default voteController;
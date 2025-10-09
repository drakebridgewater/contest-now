import { voteModel } from '@/models/Vote';
import { CreateVoteRequest, Vote, VotesByVoter, VoterInfo } from '@/types';

export class VoteService {
  public async getVotesByVoter(voterName: string): Promise<VotesByVoter> {
    return voteModel.findByVoter(voterName);
  }

  public async submitVote(voteData: CreateVoteRequest): Promise<Vote> {
    return voteModel.createOrUpdate(voteData);
  }

  public async getAllVotes(): Promise<Vote[]> {
    return voteModel.findAll();
  }

  public async getAllVoters(): Promise<VoterInfo[]> {
    return voteModel.getVoters();
  }

  public async deleteVoter(voterName: string): Promise<number> {
    return voteModel.deleteVoter(voterName);
  }
}

export const voteService = new VoteService();
export default voteService;
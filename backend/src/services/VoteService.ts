import { voteModel } from '@/models/Vote';
import { CreateVoteRequest, Vote, VotesByVoter, VoterInfo } from '@/types';
import { normalizeVoterName } from '@/utils/validation';

export class VoteService {
  public async getVotesByVoter(voterName: string): Promise<VotesByVoter> {
    const normalizedVoterName = normalizeVoterName(voterName);
    return voteModel.findByVoter(normalizedVoterName);
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

  public async updateVoterName(oldVoterName: string, newVoterName: string): Promise<number> {
    return voteModel.updateVoterName(oldVoterName, newVoterName);
  }

  public async deleteVoter(voterName: string): Promise<number> {
    const normalizedVoterName = normalizeVoterName(voterName);
    return voteModel.deleteVoter(normalizedVoterName);
  }
}

export const voteService = new VoteService();
export default voteService;
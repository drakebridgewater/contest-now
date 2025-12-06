import { contestModel } from '@/models/Contest';
import { Contest, ContestWithEvent, CreateContestRequest } from '@/types';

export class ContestService {
  public async getAllContests(): Promise<ContestWithEvent[]> {
    return contestModel.findAll();
  }

  public async getActiveContests(): Promise<ContestWithEvent[]> {
    return contestModel.findActive();
  }

  public async getContestById(id: string): Promise<ContestWithEvent> {
    return contestModel.findById(id);
  }

  public async getContestsByEventId(eventId: number): Promise<ContestWithEvent[]> {
    return contestModel.findByEventId(eventId);
  }

  public async createContest(contestData: CreateContestRequest): Promise<ContestWithEvent> {
    return contestModel.create(contestData);
  }

  public async updateContest(id: string, contestData: Partial<CreateContestRequest>): Promise<ContestWithEvent> {
    return contestModel.update(id, contestData);
  }

  public async deleteContest(id: string): Promise<void> {
    return contestModel.delete(id);
  }
}

export const contestService = new ContestService();
export default contestService;

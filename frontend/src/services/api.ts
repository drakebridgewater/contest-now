import axios from 'axios';
import {
  Event,
  CreateEventRequest,
  Contest,
  ContestWithEvent,
  CreateContestRequest,
  Entry,
  CreateEntryRequest,
  Vote,
  CreateVoteRequest,
  VotesByVoter,
  RankingVote,
  CreateRankingVoteRequest,
  RankingVotesByVoter,
  VoterInfo,
  EntryResult,
  ApiResponse,
} from '@/types';

// API Configuration - Use environment variable or fallback to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
console.log('API_URL configured as:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const eventService = {
  async getAll(): Promise<Event[]> {
    const response = await api.get<ApiResponse<Event[]>>('/events');
    return response.data.data || [];
  },

  async getActive(): Promise<Event[]> {
    const response = await api.get<ApiResponse<Event[]>>('/events/active');
    return response.data.data || [];
  },

  async getById(id: number): Promise<Event> {
    const response = await api.get<ApiResponse<Event>>(`/events/${id}`);
    if (!response.data.data) {
      throw new Error('Event not found');
    }
    return response.data.data;
  },

  async create(eventData: CreateEventRequest): Promise<Event> {
    const response = await api.post<ApiResponse<Event>>('/events', eventData);
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to create event');
    }
    return response.data.data;
  },

  async update(id: number, eventData: Partial<CreateEventRequest>): Promise<Event> {
    const response = await api.put<ApiResponse<Event>>(`/events/${id}`, eventData);
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to update event');
    }
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/events/${id}`);
  },
};

export const contestService = {
  async getAll(): Promise<ContestWithEvent[]> {
    const response = await api.get<ApiResponse<ContestWithEvent[]>>('/contests');
    return response.data.data || [];
  },

  async getActive(): Promise<ContestWithEvent[]> {
    const response = await api.get<ApiResponse<ContestWithEvent[]>>('/contests/active');
    return response.data.data || [];
  },

  async getById(id: string): Promise<ContestWithEvent> {
    const response = await api.get<ApiResponse<ContestWithEvent>>(`/contests/${id}`);
    if (!response.data.data) {
      throw new Error('Contest not found');
    }
    return response.data.data;
  },

  async getByEventId(eventId: number): Promise<ContestWithEvent[]> {
    const response = await api.get<ApiResponse<ContestWithEvent[]>>(`/contests/event/${eventId}`);
    return response.data.data || [];
  },

  async create(contestData: CreateContestRequest): Promise<ContestWithEvent> {
    const response = await api.post<ApiResponse<ContestWithEvent>>('/contests', contestData);
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to create contest');
    }
    return response.data.data;
  },

  async update(id: string, contestData: Partial<CreateContestRequest>): Promise<ContestWithEvent> {
    const response = await api.put<ApiResponse<ContestWithEvent>>(`/contests/${id}`, contestData);
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to update contest');
    }
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/contests/${id}`);
  },
};

export const entryService = {
  async getAll(contestId?: string): Promise<Entry[]> {
    const url = contestId ? `/entries?contestId=${contestId}` : '/entries';
    const response = await api.get<ApiResponse<Entry[]>>(url);
    return response.data.data || [];
  },

  async getByContest(contestId: string): Promise<Entry[]> {
    const response = await api.get<ApiResponse<Entry[]>>(`/entries?contestId=${contestId}`);
    return response.data.data || [];
  },

  async create(entryData: CreateEntryRequest): Promise<Entry> {
    const response = await api.post('/entries', entryData);
    console.log('Entry creation response:', response.data);

    // Handle both wrapped and unwrapped responses
    if (response.data.data) {
      // Wrapped response format
      return response.data.data;
    } else if (response.data.id) {
      // Direct entry format (current backend response)
      return response.data as Entry;
    } else {
      // Error case
      const error = response.data.error || 'Failed to create entry';
      console.error('Entry creation failed:', error);
      console.error('Full response:', response.data);
      throw new Error(error);
    }
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/entries/${id}`);
  },

  async getResults(contestId?: string): Promise<EntryResult[]> {
    const url = contestId ? `/results?contestId=${contestId}` : '/results';
    const response = await api.get<ApiResponse<EntryResult[]>>(url);
    return response.data.data || [];
  },
};

export const voteService = {
  async getByVoter(voterName: string): Promise<VotesByVoter> {
    const response = await api.get<ApiResponse<VotesByVoter>>(`/votes/${encodeURIComponent(voterName)}`);
    return response.data.data || {};
  },

  async submit(voteData: CreateVoteRequest): Promise<Vote> {
    const response = await api.post<ApiResponse<Vote>>('/votes', voteData);
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to submit vote');
    }
    return response.data.data;
  },

  async getAll(): Promise<Vote[]> {
    const response = await api.get<ApiResponse<Vote[]>>('/votes');
    return response.data.data || [];
  },
};

export const rankingVoteService = {
  async getByVoter(voterName: string): Promise<RankingVotesByVoter> {
    const response = await api.get<ApiResponse<RankingVotesByVoter>>(`/ranking-votes/${encodeURIComponent(voterName)}`);
    return response.data.data || {};
  },

  async submit(voteData: CreateRankingVoteRequest): Promise<RankingVote> {
    const response = await api.post<ApiResponse<RankingVote>>('/ranking-votes', voteData);
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to submit ranking vote');
    }
    return response.data.data;
  },

  async submitAll(voterName: string, rankings: Array<{ entry_id: number; rank: number }>): Promise<RankingVote[]> {
    const response = await api.post<ApiResponse<RankingVote[]>>('/ranking-votes/submit-all', {
      voter_name: voterName,
      rankings,
    });
    if (!response.data.data) {
      throw new Error(response.data.error || 'Failed to submit rankings');
    }
    return response.data.data;
  },

  async delete(voterName: string, entryId: number): Promise<void> {
    await api.delete(`/ranking-votes/${encodeURIComponent(voterName)}/${entryId}`);
  },

  async deleteAllForVoter(voterName: string): Promise<void> {
    await api.delete(`/ranking-votes/voter/${encodeURIComponent(voterName)}`);
  },

  async getAll(): Promise<RankingVote[]> {
    const response = await api.get<ApiResponse<RankingVote[]>>('/ranking-votes');
    return response.data.data || [];
  },
};

export const voterService = {
  async getAll(): Promise<VoterInfo[]> {
    const response = await api.get<ApiResponse<VoterInfo[]>>('/voters');
    return response.data.data || [];
  },

  async updateName(oldVoterName: string, newVoterName: string): Promise<void> {
    await api.put('/voters/update-name', {
      oldVoterName,
      newVoterName,
    });
  },

  async delete(voterName: string): Promise<void> {
    await api.delete(`/voters/${encodeURIComponent(voterName)}`);
  },
};

export const healthService = {
  async check(): Promise<{ status: string; message: string }> {
    const response = await api.get<ApiResponse<{ status: string; message: string }>>('/health');
    return response.data.data || { status: 'unknown', message: 'No response' };
  },
};

export default api;
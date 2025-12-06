import axios from 'axios';
import {
  Entry,
  CreateEntryRequest,
  Vote,
  CreateVoteRequest,
  VotesByVoter,
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

export const entryService = {
  async getAll(): Promise<Entry[]> {
    const response = await api.get<ApiResponse<Entry[]>>('/entries');
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

  async getResults(): Promise<EntryResult[]> {
    const response = await api.get<ApiResponse<EntryResult[]>>('/results');
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
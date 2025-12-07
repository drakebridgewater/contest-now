export interface Entry {
  id: number;
  entry_name: string;
  contestant_name: string;
  contest_type: ContestType;
  photo_path: string;
  allergens: string;
  created_at: string;
}

export interface EntryWithPhoto extends Omit<Entry, 'allergens'> {
  photo: string;
  allergens: string[];
}

export interface CreateEntryRequest {
  entry_name: string;
  contestant_name: string;
  contest_type: ContestType;
  photo: string; // base64 data URL
  allergens?: string[];
}

export interface Vote {
  id: number;
  voter_name: string;
  entry_id: number;
  appearance_rating: number;
  texture_rating: number;
  flavor_rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVoteRequest {
  voter_name: string;
  entry_id: number;
  appearance_rating: number;
  texture_rating: number;
  flavor_rating: number;
  comment?: string;
}

export interface VotesByVoter {
  [entryId: string]: {
    appearance_rating: number;
    texture_rating: number;
    flavor_rating: number;
    comment: string;
  };
}

export interface VoterInfo {
  voter_name: string;
  vote_count: number;
  first_vote: string;
  last_vote: string;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface EntryResult extends EntryWithPhoto {
  vote_count: number;
  average_rating: number;
  avg_appearance: number;
  avg_texture: number;
  avg_flavor: number;
  appearance_distribution: RatingDistribution;
  texture_distribution: RatingDistribution;
  flavor_distribution: RatingDistribution;
  comments: Array<{
    voter_name: string;
    comment: string;
  }>;
}

export type ContestType = 'dessert' | 'cocktail' | 'appetizer';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DatabaseConfig {
  path: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  corsOrigin: string;
  uploadsDir: string;
  maxFileSize: number;
  baseUrl: string;
}

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
}
import Joi from 'joi';
import { CreateEntryRequest, CreateVoteRequest, ContestType } from '@/types';

const contestTypes: ContestType[] = ['dessert', 'cocktail', 'appetizer', 'sweater', 'other'];

// UUID v4 validation pattern
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const entryValidationSchema = Joi.object<CreateEntryRequest>({
  contest_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'contest_id must be a valid UUID',
  }),
  entry_name: Joi.string().trim().min(1).max(100).required(),
  contestant_name: Joi.string().trim().min(1).max(100).required(),
  photo: Joi.string().pattern(/^data:image\/[a-zA-Z]*;base64,/).required(),
  allergens: Joi.array().items(Joi.string()).optional(),
});

export const voteValidationSchema = Joi.object<CreateVoteRequest>({
  voter_name: Joi.string().trim().min(2).max(100).required(),
  entry_id: Joi.number().integer().positive().required(),
  appearance_rating: Joi.number().integer().min(1).max(5).required(),
  texture_rating: Joi.number().integer().min(1).max(5).required(),
  flavor_rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(500).optional().allow(''),
});

export const validateEntry = (data: unknown): CreateEntryRequest => {
  const { error, value } = entryValidationSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
};

export const validateVote = (data: unknown): CreateVoteRequest => {
  const { error, value } = voteValidationSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
  }

  // Normalize voter name
  value.voter_name = normalizeVoterName(value.voter_name);

  return value;
};

export const normalizeVoterName = (voterName: string): string => {
  return voterName.trim().toLowerCase();
};

export const validateVoterName = (voterName: string | undefined): string => {
  if (!voterName) {
    throw new Error('Voter name is required');
  }

  const { error, value } = Joi.string().trim().min(2).max(100).required().validate(voterName);

  if (error) {
    throw new Error(`Invalid voter name: ${error.message}`);
  }

  return normalizeVoterName(value);
};

export const validateEntryId = (entryId: string | number | undefined): number => {
  if (!entryId) {
    throw new Error('Entry ID is required');
  }

  const { error, value } = Joi.number().integer().positive().required().validate(entryId);

  if (error) {
    throw new Error(`Invalid entry ID: ${error.message}`);
  }

  return value;
};

export const updateVoterNameSchema = Joi.object({
  oldVoterName: Joi.string().trim().min(2).max(100).required(),
  newVoterName: Joi.string().trim().min(2).max(100).required(),
});

export const validateUpdateVoterName = (data: unknown): { oldVoterName: string; newVoterName: string } => {
  const { error, value } = updateVoterNameSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation error: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
};
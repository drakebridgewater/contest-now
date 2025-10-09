import { validateEntry, validateVote, validateVoterName, validateEntryId } from '../src/utils/validation';
import { CreateEntryRequest, CreateVoteRequest } from '../src/types';

describe('Validation', () => {
  describe('validateEntry', () => {
    const validEntry: CreateEntryRequest = {
      entry_name: 'Test Entry',
      contestant_name: 'Test Contestant',
      contest_type: 'dessert',
      photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD',
      allergens: ['dairy', 'nuts'],
    };

    it('should validate a correct entry', () => {
      expect(() => validateEntry(validEntry)).not.toThrow();
    });

    it('should reject entry without required fields', () => {
      const invalidEntry = { ...validEntry };
      delete (invalidEntry as any).entry_name;
      expect(() => validateEntry(invalidEntry)).toThrow('Validation error');
    });

    it('should reject invalid contest type', () => {
      const invalidEntry = { ...validEntry, contest_type: 'invalid' as any };
      expect(() => validateEntry(invalidEntry)).toThrow('Validation error');
    });

    it('should reject invalid photo format', () => {
      const invalidEntry = { ...validEntry, photo: 'not-a-base64-image' };
      expect(() => validateEntry(invalidEntry)).toThrow('Validation error');
    });
  });

  describe('validateVote', () => {
    const validVote: CreateVoteRequest = {
      voter_name: 'Test Voter',
      entry_id: 1,
      appearance_rating: 5,
      texture_rating: 4,
      flavor_rating: 3,
      comment: 'Great entry!',
    };

    it('should validate a correct vote', () => {
      expect(() => validateVote(validVote)).not.toThrow();
    });

    it('should reject vote with invalid ratings', () => {
      const invalidVote = { ...validVote, appearance_rating: 6 };
      expect(() => validateVote(invalidVote)).toThrow('Validation error');
    });

    it('should reject vote with short voter name', () => {
      const invalidVote = { ...validVote, voter_name: 'A' };
      expect(() => validateVote(invalidVote)).toThrow('Validation error');
    });
  });

  describe('validateVoterName', () => {
    it('should validate correct voter name', () => {
      expect(validateVoterName('John Doe')).toBe('John Doe');
    });

    it('should reject short voter name', () => {
      expect(() => validateVoterName('A')).toThrow('Invalid voter name');
    });
  });

  describe('validateEntryId', () => {
    it('should validate correct entry ID', () => {
      expect(validateEntryId('123')).toBe(123);
      expect(validateEntryId(456)).toBe(456);
    });

    it('should reject invalid entry ID', () => {
      expect(() => validateEntryId('invalid')).toThrow('Invalid entry ID');
      expect(() => validateEntryId(-1)).toThrow('Invalid entry ID');
    });
  });
});
import React from 'react';
import { Entry, VotesByVoter } from '@/types';
import StarRating from './StarRating';
import { Textarea, Button } from '@/components/common';
import { RATING_DESCRIPTIONS } from '@/utils/constants';

interface VoteCardProps {
  entry: Entry;
  userVote: VotesByVoter[string] | undefined;
  onRatingChange: (entryId: number, ratingType: string, rating: number) => void;
  onCommentChange: (entryId: number, comment: string) => void;
  onAllergenClick: (entryName: string, allergens: string[]) => void;
  disabled?: boolean;
}

const VoteCard: React.FC<VoteCardProps> = ({
  entry,
  userVote = {
    appearance_rating: 0,
    texture_rating: 0,
    flavor_rating: 0,
    comment: '',
  },
  onRatingChange,
  onCommentChange,
  onAllergenClick,
  disabled = false,
}) => {
  const isVoteComplete =
    userVote.appearance_rating > 0 &&
    userVote.texture_rating > 0 &&
    userVote.flavor_rating > 0;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="relative">
        <img
          src={entry.photo}
          alt={entry.entry_name}
          className="w-full h-64 object-cover"
        />
        {entry.allergens && entry.allergens.length > 0 && (
          <div className="absolute top-2 right-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onAllergenClick(entry.entry_name, entry.allergens)}
              className="p-2 rounded-full shadow-lg"
              title="Contains allergens - Click for details"
            >
              ⚠️
            </Button>
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-1">
          {entry.entry_name}
        </h3>
        <p className="text-gray-600 mb-4">by {entry.contestant_name}</p>

        <div className="space-y-4">
          <StarRating
            value={userVote.appearance_rating}
            onChange={(rating) => onRatingChange(entry.id, 'appearance_rating', rating)}
            title="Appearance Rating"
            description={RATING_DESCRIPTIONS.appearance}
            disabled={disabled}
          />

          <StarRating
            value={userVote.texture_rating}
            onChange={(rating) => onRatingChange(entry.id, 'texture_rating', rating)}
            title="Texture Rating"
            description={RATING_DESCRIPTIONS.texture}
            disabled={disabled}
          />

          <StarRating
            value={userVote.flavor_rating}
            onChange={(rating) => onRatingChange(entry.id, 'flavor_rating', rating)}
            title="Flavor Rating"
            description={RATING_DESCRIPTIONS.flavor}
            disabled={disabled}
          />

          <Textarea
            label="Your Comment"
            value={userVote.comment}
            onChange={(e) => onCommentChange(entry.id, e.target.value)}
            rows={3}
            placeholder="Share your thoughts..."
            disabled={disabled}
          />

          {isVoteComplete && (
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <span className="text-sm text-green-700 font-medium">
                ✓ Vote submitted successfully!
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteCard;
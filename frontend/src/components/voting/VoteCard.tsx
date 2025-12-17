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
  onAllergenClick?: (entryName: string, allergens: string[]) => void;
  disabled?: boolean;
  showAllergens?: boolean;
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
  showAllergens = true,
}) => {
  const isVoteComplete =
    userVote.appearance_rating > 0 &&
    userVote.texture_rating > 0 &&
    userVote.flavor_rating > 0;

  const hasPartialRatings =
    (userVote.appearance_rating > 0 ? 1 : 0) +
    (userVote.texture_rating > 0 ? 1 : 0) +
    (userVote.flavor_rating > 0 ? 1 : 0) > 0;

  const cardBorderClass = isVoteComplete
    ? "border-2 border-green-400 bg-green-50"
    : hasPartialRatings
    ? "border-2 border-red-400 bg-red-50"
    : "border border-gray-200 bg-white";

  const completionPercentage = Math.round(
    ((userVote.appearance_rating > 0 ? 1 : 0) +
    (userVote.texture_rating > 0 ? 1 : 0) +
    (userVote.flavor_rating > 0 ? 1 : 0)) / 3 * 100
  );

  return (
    <div className={`rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl ${cardBorderClass}`}>
      <div className="relative">
        <img
          src={entry.photo}
          alt={entry.entry_name}
          className="w-full h-64 object-cover"
        />
        
        {/* Progress indicator overlay at bottom of image */}
        {!isVoteComplete && hasPartialRatings && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
              <div
                className="bg-yellow-400 h-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-white text-xs font-semibold mt-1 text-center">
              {completionPercentage}% Complete
            </p>
          </div>
        )}

        {showAllergens && entry.allergens && entry.allergens.length > 0 && onAllergenClick && (
          <div className="absolute top-3 right-3">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onAllergenClick(entry.entry_name, entry.allergens)}
              className="p-2 rounded-full shadow-lg animate-pulse"
              title="Contains allergens - Click for details"
            >
              <span className="text-lg">⚠️</span>
            </Button>
          </div>
        )}
        {/* Vote status indicator */}
        <div className="absolute top-3 left-3">
          {isVoteComplete ? (
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
              <span className="text-lg">✓</span>
              <span>Complete</span>
            </div>
          ) : hasPartialRatings ? (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 animate-pulse">
              <span className="text-lg">⚡</span>
              <span>In Progress</span>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
              <span className="text-lg">○</span>
              <span>Start Voting</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-5">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            {entry.entry_name}
          </h3>
          <p className="text-gray-600 text-sm flex items-center gap-2">
            <span className="text-lg">👤</span>
            <span>by <span className="font-semibold">{entry.contestant_name}</span></span>
          </p>
        </div>

        <div className="space-y-5">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
            <StarRating
              value={userVote.appearance_rating}
              onChange={(rating) => onRatingChange(entry.id, 'appearance_rating', rating)}
              title="👁️ Appearance"
              description={RATING_DESCRIPTIONS.appearance}
              disabled={disabled}
            />
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg">
            <StarRating
              value={userVote.texture_rating}
              onChange={(rating) => onRatingChange(entry.id, 'texture_rating', rating)}
              title="✋ Texture"
              description={RATING_DESCRIPTIONS.texture}
              disabled={disabled}
            />
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
            <StarRating
              value={userVote.flavor_rating}
              onChange={(rating) => onRatingChange(entry.id, 'flavor_rating', rating)}
              title="👅 Flavor"
              description={RATING_DESCRIPTIONS.flavor}
              disabled={disabled}
            />
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-lg">
            <Textarea
              label="💬 Your Comment (Optional)"
              value={userVote.comment}
              onChange={(e) => onCommentChange(entry.id, e.target.value)}
              rows={3}
              placeholder="Share your thoughts about this entry..."
              disabled={disabled}
              className="bg-white"
            />
          </div>

          {isVoteComplete && (
            <div className="text-center p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg shadow-lg animate-pulse">
              <span className="text-white font-bold flex items-center justify-center gap-2">
                <span className="text-2xl">🎉</span>
                <span>Vote submitted successfully!</span>
                <span className="text-2xl">🎉</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteCard;
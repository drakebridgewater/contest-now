import React, { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { Entry, VotesByVoter, AllergenPopupData, ContestType } from '@/types';
import { VoterNameForm, VoteCard, AllergenModal } from '@/components/voting';
import { Button } from '@/components/common';
import { CONTEST_TYPES } from '@/utils/constants';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { voteService } from '@/services/api';
import { isVoteComplete } from '@/utils/helpers';

interface VotePageProps {
  entries: Entry[];
  voterName: string;
  isVoterNameSubmitted: boolean;
  votes: { [voterName: string]: VotesByVoter };
  onVoterNameSubmit: (name: string) => void;
  onVoterLogout: () => void;
  onVoteChange: (voterName: string, entryId: number, ratingType: string, rating: number) => void;
  onCommentChange: (voterName: string, entryId: number, comment: string) => void;
}

const VotePage: React.FC<VotePageProps> = ({
  entries,
  voterName,
  isVoterNameSubmitted,
  votes,
  onVoterNameSubmit,
  onVoterLogout,
  onVoteChange,
  onCommentChange,
}) => {
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false);
  const [allergenPopup, setAllergenPopup] = useState<AllergenPopupData | null>(null);

  const { timeRemaining } = useAutoLogout({
    isEnabled: autoLogoutEnabled,
    isActive: isVoterNameSubmitted,
    onLogout: onVoterLogout,
  });

  const handleRatingChange = async (entryId: number, ratingType: string, rating: number) => {
    if (!voterName) {
      alert('Please enter your name first');
      return;
    }

    const currentVote = votes[voterName]?.[entryId] || {
      appearance_rating: 0,
      texture_rating: 0,
      flavor_rating: 0,
      comment: '',
    };

    const updatedVote = { ...currentVote, [ratingType]: rating };

    // Submit vote if all ratings are provided
    if (isVoteComplete(updatedVote)) {
      try {
        await voteService.submit({
          voter_name: voterName,
          entry_id: entryId,
          appearance_rating: updatedVote.appearance_rating,
          texture_rating: updatedVote.texture_rating,
          flavor_rating: updatedVote.flavor_rating,
          comment: updatedVote.comment,
        });
      } catch (error) {
        console.error('Error submitting rating:', error);
        alert('Failed to submit rating. Please try again.');
        return;
      }
    }

    onVoteChange(voterName, entryId, ratingType, rating);
  };

  const handleCommentChange = async (entryId: number, comment: string) => {
    if (!voterName) {
      alert('Please enter your name first');
      return;
    }

    const currentVote = votes[voterName]?.[entryId] || {
      appearance_rating: 0,
      texture_rating: 0,
      flavor_rating: 0,
      comment: '',
    };

    const updatedVote = { ...currentVote, comment };

    // Submit vote if all ratings are provided
    if (isVoteComplete(updatedVote)) {
      try {
        await voteService.submit({
          voter_name: voterName,
          entry_id: entryId,
          appearance_rating: updatedVote.appearance_rating,
          texture_rating: updatedVote.texture_rating,
          flavor_rating: updatedVote.flavor_rating,
          comment: comment,
        });
      } catch (error) {
        console.error('Error submitting comment:', error);
        return;
      }
    }

    onCommentChange(voterName, entryId, comment);
  };

  const handleAllergenClick = (entryName: string, allergens: string[]) => {
    setAllergenPopup({ entryName, allergens });
  };

  if (!isVoterNameSubmitted) {
    return (
      <VoterNameForm
        onSubmit={onVoterNameSubmit}
        autoLogoutEnabled={autoLogoutEnabled}
        onAutoLogoutToggle={setAutoLogoutEnabled}
      />
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center">
          <p className="text-lg">
            Voting as: <span className="font-bold text-indigo-600">{voterName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onVoterLogout}
              className="ml-4 text-sm underline"
            >
              Change voter
            </Button>
          </p>
          {autoLogoutEnabled && timeRemaining > 0 && (
            <div className="text-sm text-orange-600 font-medium">
              🔄 Auto-logout in {timeRemaining}s
            </div>
          )}
        </div>
        {autoLogoutEnabled && (
          <p className="text-xs text-gray-500 mt-2">
            Auto-logout enabled - touch anywhere to reset timer
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">No entries yet</p>
          <p className="text-gray-400">Submit the first entry to get started!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(CONTEST_TYPES).map(([contestType, { name, emoji }]) => {
            const contestEntries = entries.filter(entry => entry.contest_type === contestType as ContestType);
            if (contestEntries.length === 0) return null;

            return (
              <div key={contestType}>
                <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="text-3xl">{emoji}</span>
                  {name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contestEntries.map((entry) => (
                    <VoteCard
                      key={entry.id}
                      entry={entry}
                      userVote={votes[voterName]?.[entry.id]}
                      onRatingChange={handleRatingChange}
                      onCommentChange={handleCommentChange}
                      onAllergenClick={handleAllergenClick}
                      disabled={!voterName}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AllergenModal
        isOpen={!!allergenPopup}
        onClose={() => setAllergenPopup(null)}
        data={allergenPopup}
      />
    </>
  );
};

export default VotePage;
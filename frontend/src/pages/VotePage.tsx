import React, { useState, useMemo } from 'react';
import { ImageIcon } from 'lucide-react';
import { Entry, VotesByVoter, AllergenPopupData, ContestType } from '@/types';
import { VoterNameForm, VoteCard, AllergenModal } from '@/components/voting';
import { Button, MenuBar, AlertDialog } from '@/components/common';
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
  const [hideCompletedVotes, setHideCompletedVotes] = useState(false);
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  const { timeRemaining } = useAutoLogout({
    isEnabled: autoLogoutEnabled,
    isActive: isVoterNameSubmitted,
    onLogout: onVoterLogout,
  });

  const handleRatingChange = async (entryId: number, ratingType: string, rating: number) => {
    if (!voterName) {
      setAlert({
        isOpen: true,
        title: 'Authentication Required',
        message: 'Please enter your name first',
        variant: 'warning'
      });
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
        setAlert({
          isOpen: true,
          title: 'Submission Error',
          message: 'Failed to submit rating. Please try again.',
          variant: 'error'
        });
        return;
      }
    }

    onVoteChange(voterName, entryId, ratingType, rating);
  };

  const handleCommentChange = async (entryId: number, comment: string) => {
    if (!voterName) {
      setAlert({
        isOpen: true,
        title: 'Authentication Required',
        message: 'Please enter your name first',
        variant: 'warning'
      });
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

  // Calculate voting progress
  const votingProgress = useMemo(() => {
    if (!voterName || entries.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const userVotes = votes[voterName] || {};
    const completedVotes = entries.filter(entry =>
      userVotes[entry.id] && isVoteComplete(userVotes[entry.id])
    ).length;

    return {
      completed: completedVotes,
      total: entries.length,
      percentage: Math.round((completedVotes / entries.length) * 100)
    };
  }, [voterName, votes, entries]);

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
      <MenuBar
        title={`Voting as: ${voterName}`}
        subtitle={autoLogoutEnabled ? 'Auto-logout enabled - touch anywhere to reset timer' : undefined}
        actions={[
          {
            label: hideCompletedVotes ? 'Show All Entries' : 'Hide Voted Entries',
            onClick: () => setHideCompletedVotes(!hideCompletedVotes),
            variant: hideCompletedVotes ? 'secondary' : 'ghost',
            icon: hideCompletedVotes ? '👁️' : '🫥'
          },
          {
            label: 'Change voter',
            onClick: onVoterLogout,
            variant: 'ghost',
            icon: '👤'
          }
        ]}
        status={autoLogoutEnabled && timeRemaining > 0 ? {
          text: `🔄 Auto-logout in ${timeRemaining}s`,
          variant: 'warning'
        } : votingProgress.total > 0 ? {
          text: `🗳️ Voted: ${votingProgress.completed}/${votingProgress.total} (${votingProgress.percentage}%)`,
          variant: votingProgress.percentage === 100 ? 'success' : 'info'
        } : undefined}
      />

      {entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">No entries yet</p>
          <p className="text-gray-400">Submit the first entry to get started!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(() => {
            // Check if any entries will be shown after filtering
            const userVotes = votes[voterName] || {};
            const hasVisibleEntries = Object.entries(CONTEST_TYPES).some(([contestType]) => {
              const contestEntries = entries.filter(entry => entry.contest_type === contestType as ContestType);
              if (contestEntries.length === 0) return false;

              const filteredEntries = hideCompletedVotes
                ? contestEntries.filter(entry =>
                    !userVotes[entry.id] || !isVoteComplete(userVotes[entry.id])
                  )
                : contestEntries;

              return filteredEntries.length > 0;
            });

            // Show message if all entries are filtered out
            if (hideCompletedVotes && !hasVisibleEntries) {
              return (
                <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                  <div className="text-4xl mb-4">🎉</div>
                  <p className="text-gray-700 text-xl font-semibold mb-2">
                    All done! You've voted on all entries.
                  </p>
                  <p className="text-gray-500 mb-4">
                    Click "Show All Entries" to review your votes.
                  </p>
                </div>
              );
            }

            return Object.entries(CONTEST_TYPES).map(([contestType, { name, emoji }]) => {
              const contestEntries = entries.filter(entry => entry.contest_type === contestType as ContestType);
              if (contestEntries.length === 0) return null;

              // Filter out completed votes if hide toggle is enabled
              const filteredEntries = hideCompletedVotes
                ? contestEntries.filter(entry =>
                    !userVotes[entry.id] || !isVoteComplete(userVotes[entry.id])
                  )
                : contestEntries;

              // Don't render section if all entries are filtered out
              if (filteredEntries.length === 0) return null;

              return (
                <div key={contestType}>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span className="text-3xl">{emoji}</span>
                    {name}
                    {hideCompletedVotes && (
                      <span className="text-sm font-normal text-gray-600">
                        ({filteredEntries.length} of {contestEntries.length} shown)
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredEntries.map((entry) => (
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
            });
          })()}
        </div>
      )}

      <AllergenModal
        isOpen={!!allergenPopup}
        onClose={() => setAllergenPopup(null)}
        data={allergenPopup}
      />

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </>
  );
};

export default VotePage;
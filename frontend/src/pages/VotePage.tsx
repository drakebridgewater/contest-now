import React, { useState, useMemo, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { Entry, VotesByVoter, AllergenPopupData, ContestWithEvent } from '@/types';
import { VoterNameForm, VoteCard, AllergenModal } from '@/components/voting';
import { MenuBar, AlertDialog } from '@/components/common';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { voteService, contestService } from '@/services/api';
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
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    const loadContests = async () => {
      try {
        const activeContests = await contestService.getActive();
        // Filter out sweater contests (they use the ranking page)
        const nonSweaterContests = activeContests.filter(c => c.contest_type !== 'sweater');
        setContests(nonSweaterContests);
      } catch (error) {
        console.error('Error loading contests:', error);
      }
    };
    loadContests();
  }, []);

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
    const filteredEntries = selectedContestId
      ? entries.filter(e => e.contest_id === selectedContestId)
      : entries;

    if (!voterName || filteredEntries.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const userVotes = votes[voterName] || {};
    const completedVotes = filteredEntries.filter(entry =>
      userVotes[entry.id] && isVoteComplete(userVotes[entry.id])
    ).length;

    return {
      completed: completedVotes,
      total: filteredEntries.length,
      percentage: Math.round((completedVotes / filteredEntries.length) * 100)
    };
  }, [voterName, votes, entries, selectedContestId]);

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

      {/* Contest Tabs */}
      {contests.length > 1 && (
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <nav className="flex border-b border-gray-200" aria-label="Contest Tabs">
              <button
                onClick={() => setSelectedContestId(null)}
                className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
                  selectedContestId === null
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="text-lg">🎯</span>
                  All Contests
                </span>
              </button>
              {contests.map((contest) => {
                const contestEmoji = contest.contest_type === 'dessert' ? '🍰' :
                                   contest.contest_type === 'cocktail' ? '🍹' :
                                   contest.contest_type === 'appetizer' ? '🥗' : '🎯';

                return (
                  <button
                    key={contest.id}
                    onClick={() => setSelectedContestId(contest.id)}
                    className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
                      selectedContestId === contest.id
                        ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-lg">{contestEmoji}</span>
                      <span className="hidden sm:inline">{contest.contest_name}</span>
                      <span className="sm:hidden">{contest.contest_type}</span>
                    </span>
                    <div className="text-xs text-gray-400 mt-1 hidden sm:block">
                      {contest.event_name}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {(() => {
        const filteredEntries = selectedContestId
          ? entries.filter(e => e.contest_id === selectedContestId)
          : entries;

        if (filteredEntries.length === 0) {
          return (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg">
              <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">No entries yet</p>
              <p className="text-gray-400">Submit the first entry to get started!</p>
            </div>
          );
        }

        // Group entries by contest
        const entriesByContest: { [contestId: string]: Entry[] } = {};
        filteredEntries.forEach(entry => {
          if (!entriesByContest[entry.contest_id]) {
            entriesByContest[entry.contest_id] = [];
          }
          entriesByContest[entry.contest_id].push(entry);
        });

        return (
          <div className="space-y-8">
            {Object.entries(entriesByContest).map(([contestId, contestEntries]) => {
              const contest = contests.find(c => c.id === contestId);
              const userVotes = votes[voterName] || {};

              // Filter out completed votes if hide toggle is enabled
              const visibleEntries = hideCompletedVotes
                ? contestEntries.filter(entry =>
                    !userVotes[entry.id] || !isVoteComplete(userVotes[entry.id])
                  )
                : contestEntries;

              // Don't render section if all entries are filtered out
              if (visibleEntries.length === 0) return null;

              const contestEmoji = contest?.contest_type === 'dessert' ? '🍰' :
                                 contest?.contest_type === 'cocktail' ? '🍹' : '🥗';

              return (
                <div key={contestId}>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <span className="text-3xl">{contestEmoji}</span>
                    {contest?.contest_name || 'Unknown Contest'}
                    {hideCompletedVotes && (
                      <span className="text-sm font-normal text-gray-600">
                        ({visibleEntries.length} of {contestEntries.length} shown)
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {visibleEntries.map((entry) => (
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
        );
      })()}

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

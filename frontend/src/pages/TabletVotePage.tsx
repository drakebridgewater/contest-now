import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { Entry, VotesByVoter, AllergenPopupData, ContestWithEvent, Event } from '@/types';
import { VoterNameForm, VoteCard, AllergenModal } from '@/components/voting';
import { AlertDialog } from '@/components/common';
import { Layout } from '@/components/layout';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { voteService, contestService, entryService, eventService } from '@/services/api';
import { isVoteComplete } from '@/utils/helpers';

const TabletVotePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // State for event and contests
  const [event, setEvent] = useState<Event | null>(null);
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Voting state
  const [voterName, setVoterName] = useLocalStorage<string>('tablet-voter-name', '');
  const [votes, setVotes] = useLocalStorage<{[voterName: string]: VotesByVoter}>('tablet-votes', {});
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true); // Default enabled for tablets

  // UI state
  const [allergenPopup, setAllergenPopup] = useState<AllergenPopupData | null>(null);
  const [hideCompletedVotes, setHideCompletedVotes] = useState(false);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  // Load data on mount
  useEffect(() => {
    if (!eventId) {
      navigate('/');
      return;
    }
    loadEventData();
  }, [eventId, navigate]);

  // Load voter votes when voter changes
  useEffect(() => {
    if (voterName && voterName.trim().length >= 2) {
      loadVoterVotes(voterName);
    }
  }, [voterName]);

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      const [eventData, contestsData] = await Promise.all([
        eventService.getById(parseInt(eventId)),
        contestService.getByEventId(parseInt(eventId))
      ]);

      setEvent(eventData);
      setContests(contestsData);

      // Load all entries for this event's contests
      const allEntries: Entry[] = [];
      for (const contest of contestsData) {
        const contestEntries = await entryService.getByContest(contest.id);
        allEntries.push(...contestEntries);
      }
      setEntries(allEntries);

    } catch (error) {
      console.error('Error loading event data:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load event. This event may not exist or be inactive.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVoterVotes = async (voter: string) => {
    if (!voter) return;

    try {
      const data = await voteService.getByVoter(voter);
      setVotes(prev => ({ ...prev, [voter]: data }));
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  };

  const { timeRemaining } = useAutoLogout({
    isEnabled: autoLogoutEnabled,
    isActive: !!voterName,
    onLogout: handleVoterLogout,
  });

  const handleVoterNameSubmit = (name: string) => {
    setVoterName(name);
    loadVoterVotes(name);

    if (!votes[name]) {
      setVotes(prev => ({ ...prev, [name]: {} }));
    }
  };

  function handleVoterLogout() {
    setVoterName('');
  }

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

    // Update local state
    setVotes(prev => {
      const updatedVotes = { ...prev };
      if (!updatedVotes[voterName]) {
        updatedVotes[voterName] = {};
      }
      updatedVotes[voterName][entryId] = updatedVote;
      return updatedVotes;
    });
  };

  const handleCommentChange = async (entryId: number, comment: string) => {
    if (!voterName) return;

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

    // Update local state
    setVotes(prev => {
      const updatedVotes = { ...prev };
      if (!updatedVotes[voterName]) {
        updatedVotes[voterName] = {};
      }
      if (!updatedVotes[voterName][entryId]) {
        updatedVotes[voterName][entryId] = {
          appearance_rating: 0,
          texture_rating: 0,
          flavor_rating: 0,
          comment: '',
        };
      }
      updatedVotes[voterName][entryId] = { ...updatedVotes[voterName][entryId], comment };
      return updatedVotes;
    });
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

  const isConsumableContest = (contestType: string) => {
    return ['dessert', 'cocktail', 'appetizer'].includes(contestType);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading event...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!event || contests.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Event Not Found</h2>
            <p className="text-gray-600 mb-6">The event you're looking for doesn't exist or has no active contests.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!voterName) {
    return (
      <Layout>
        <VoterNameForm
          onSubmit={handleVoterNameSubmit}
          autoLogoutEnabled={autoLogoutEnabled}
          onAutoLogoutToggle={setAutoLogoutEnabled}
          eventName={event.event_name}
        />
      </Layout>
    );
  }

  return (
    <Layout currentUser={voterName} onLogout={handleVoterLogout} showUserMenu={true}>
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                🎄 {event.event_name} - Tablet Voting
              </h1>
              <p className="text-gray-600 mt-1">
                Vote on all contests for this event with auto-logout enabled
              </p>
            </div>
            <div className="flex items-center gap-4">
              {autoLogoutEnabled && timeRemaining > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 text-sm font-medium rounded-full">
                  🔄 Auto-logout in {timeRemaining}s
                </span>
              )}
              {votingProgress.total > 0 && (
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  votingProgress.percentage === 100 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  🗳️ Voted: {votingProgress.completed}/{votingProgress.total} ({votingProgress.percentage}%)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setHideCompletedVotes(!hideCompletedVotes)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              hideCompletedVotes
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {hideCompletedVotes ? '👁️ Show All Entries' : '🫥 Hide Voted Entries'}
          </button>
        </div>

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
                                   contest?.contest_type === 'cocktail' ? '🍹' :
                                   contest?.contest_type === 'appetizer' ? '🥗' : '🎯';

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
                          onAllergenClick={isConsumableContest(contest?.contest_type || '') ? handleAllergenClick : undefined}
                          disabled={!voterName}
                          showAllergens={isConsumableContest(contest?.contest_type || '')}
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
      </div>
    </Layout>
  );
};

export default TabletVotePage;
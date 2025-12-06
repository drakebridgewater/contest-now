import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { ContestWithEvent, Entry, VotesByVoter, AllergenPopupData } from '@/types';
import { Button, LoadingSpinner, AlertDialog } from '@/components/common';
import { Layout } from '@/components/layout';
import ContestEntryForm from '@/components/forms/ContestEntryForm';
import { VoteCard, AllergenModal } from '@/components/voting';
import { contestService, entryService, voteService } from '@/services/api';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { formatDate } from '@/utils/helpers';
import { isVoteComplete } from '@/utils/helpers';

const ContestPage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();

  const [contest, setContest] = useState<ContestWithEvent | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentView, setCurrentView] = useState<'submit' | 'vote'>('submit');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Voter state (persistent across contests)
  const [voterName, setVoterName] = useLocalStorage<string>('contest-voter-name', '');
  const [votes, setVotes] = useLocalStorage<{[voterName: string]: VotesByVoter}>('contest-votes', {});

  const [allergenPopup, setAllergenPopup] = useState<AllergenPopupData | null>(null);
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    if (!contestId) {
      navigate('/');
      return;
    }
    loadContestData();
  }, [contestId, navigate]);

  const loadContestData = async () => {
    if (!contestId) return;

    try {
      setLoading(true);

      // Load contest details and entries in parallel
      const [contestData, entriesData] = await Promise.all([
        contestService.getById(contestId),
        entryService.getByContest(contestId)
      ]);

      setContest(contestData);
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading contest data:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load contest. This contest may not exist or be inactive.',
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

  useEffect(() => {
    if (voterName && voterName.trim().length >= 2) {
      loadVoterVotes(voterName);
    }
  }, [voterName]);

  const handleEntrySubmit = async (entryData: any) => {
    if (!contestId) return;

    try {
      setSubmitting(true);
      await entryService.create({ ...entryData, contest_id: contestId });

      setAlert({
        isOpen: true,
        title: 'Success!',
        message: 'Your entry has been submitted successfully!',
        variant: 'success'
      });

      // Reload entries
      const updatedEntries = await entryService.getByContest(contestId);
      setEntries(updatedEntries);
    } catch (error) {
      console.error('Error submitting entry:', error);
      setAlert({
        isOpen: true,
        title: 'Submission Error',
        message: 'Failed to submit entry. Please try again.',
        variant: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoterNameSubmit = (name: string) => {
    setVoterName(name);
    loadVoterVotes(name);

    if (!votes[name]) {
      setVotes(prev => ({ ...prev, [name]: {} }));
    }
  };

  const handleVoterLogout = () => {
    setVoterName('');
  };

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

  // Calculate voting progress for current contest
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

  const getContestEmoji = (contestType: string) => {
    switch (contestType) {
      case 'dessert': return '🍰';
      case 'cocktail': return '🍹';
      case 'appetizer': return '🥗';
      case 'other': return '🏆';
      default: return '🎯';
    }
  };

  const isConsumableContest = (contestType: string) => {
    return ['dessert', 'cocktail', 'appetizer'].includes(contestType);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4 text-green-600" />
            <p className="text-gray-600 text-lg">Loading contest...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!contest) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Contest Not Found</h2>
            <p className="text-gray-600 mb-6">The contest you're looking for doesn't exist or is no longer active.</p>
            <Button onClick={() => navigate('/')}>
              Back to Contest Selection
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentUser={voterName} onLogout={handleVoterLogout}>
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {getContestEmoji(contest.contest_type)} {contest.contest_name}
              </h1>
              <p className="text-gray-600 mt-1">
                {contest.event_name} • {formatDate(contest.event_date, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
                {contest.description ? ` • ${contest.description}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
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

        {/* View Toggle */}
        <div className="flex gap-4 mb-6">
          <Button
            onClick={() => setCurrentView('submit')}
            variant={currentView === 'submit' ? 'primary' : 'ghost'}
          >
            🎁 Submit Entry
          </Button>
          <Button
            onClick={() => setCurrentView('vote')}
            variant={currentView === 'vote' ? 'primary' : 'ghost'}
          >
            🗳️ Vote
          </Button>
        </div>
        {currentView === 'submit' && (
          <ContestEntryForm
            contestId={contestId!}
            contest={contest}
            onSubmit={handleEntrySubmit}
            loading={submitting}
          />
        )}

        {currentView === 'vote' && (
          <div>
            {!voterName ? (
              <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Enter Your Name to Vote</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement;
                        const name = target.value.trim();
                        if (name.length >= 2) {
                          handleVoterNameSubmit(name);
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      const name = input.value.trim();
                      if (name.length >= 2) {
                        handleVoterNameSubmit(name);
                      }
                    }}
                    className="w-full"
                  >
                    Start Voting
                  </Button>
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">No entries yet</p>
                <p className="text-gray-400">Be the first to submit an entry!</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {entries.map((entry) => (
                    <VoteCard
                      key={entry.id}
                      entry={entry}
                      userVote={votes[voterName]?.[entry.id]}
                      onRatingChange={handleRatingChange}
                      onCommentChange={handleCommentChange}
                      onAllergenClick={isConsumableContest(contest.contest_type) ? handleAllergenClick : undefined}
                      disabled={!voterName}
                      showAllergens={isConsumableContest(contest.contest_type)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
    </Layout>
  );
};

export default ContestPage;
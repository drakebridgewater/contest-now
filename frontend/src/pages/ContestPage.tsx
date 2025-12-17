import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ImageIcon, Trophy, Star, Check, Info, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { ContestWithEvent, Entry, VotesByVoter, AllergenPopupData } from '@/types';
import { Button, LoadingSpinner, AlertDialog } from '@/components/common';
import { Layout } from '@/components/layout';
import ContestEntryForm from '@/components/forms/ContestEntryForm';
import { VoteCard, AllergenModal } from '@/components/voting';
import { contestService, entryService, voteService, rankingVoteService } from '@/services/api';
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

  // Sweater contest ranking state
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [rankedEntries, setRankedEntries] = useState<number[]>([]);
  const [isRankingMode, setIsRankingMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  const [allergenPopup, setAllergenPopup] = useState<AllergenPopupData | null>(null);
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  const loadVoterRankingsForEntries = useCallback(async (voter: string, entriesList: Entry[]) => {
    if (!voter || !contestId) return;
    try {
      const rankings = await rankingVoteService.getByVoter(voter);
      
      // Filter rankings to only include entries from this contest
      const contestEntryIds = new Set(entriesList.map(e => e.id));
      const contestRankings = Object.entries(rankings)
        .filter(([entryId]) => contestEntryIds.has(parseInt(entryId)))
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([entryId]) => parseInt(entryId));
      
      if (contestRankings.length > 0) {
        setSelectedEntries(contestRankings);
        setRankedEntries(contestRankings);
        setIsRankingMode(contestRankings.length === 5);
      }
    } catch (error) {
      console.error('Error loading rankings:', error);
    }
  }, [contestId]);

  const loadContestData = useCallback(async () => {
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

      // Reset ranking state when loading new contest
      setSelectedEntries([]);
      setRankedEntries([]);
      setIsRankingMode(false);

      // Load existing rankings if this is a sweater contest
      if (contestData.contest_type === 'sweater' && voterName) {
        await loadVoterRankingsForEntries(voterName, entriesData);
      }
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
  }, [contestId, voterName, loadVoterRankingsForEntries]);

  useEffect(() => {
    if (!contestId) {
      navigate('/');
      return;
    }
    loadContestData();
  }, [contestId, navigate, loadContestData]);

  const loadVoterVotes = useCallback(async (voter: string) => {
    if (!voter) return;

    try {
      const data = await voteService.getByVoter(voter);
      setVotes(prev => ({ ...prev, [voter]: data }));
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  }, []);

  useEffect(() => {
    if (voterName && voterName.trim().length >= 2) {
      loadVoterVotes(voterName);
    }
  }, [voterName, loadVoterVotes]);

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

  const handleVoterNameSubmit = async (name: string) => {
    setVoterName(name);
    loadVoterVotes(name);

    if (!votes[name]) {
      setVotes(prev => ({ ...prev, [name]: {} }));
    }

    // Load sweater rankings if this is a sweater contest
    if (contest?.contest_type === 'sweater') {
      await loadVoterRankingsForEntries(name, entries);
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

  // Sweater contest ranking handlers
  const handleEntrySelect = (entryId: number) => {
    if (isRankingMode) return;
    
    if (selectedEntries.includes(entryId)) {
      setSelectedEntries(selectedEntries.filter(id => id !== entryId));
    } else if (selectedEntries.length < 5) {
      setSelectedEntries([...selectedEntries, entryId]);
    } else {
      setAlert({
        isOpen: true,
        title: 'Maximum Selections',
        message: 'You can only select up to 5 sweaters.',
        variant: 'info'
      });
    }
  };

  const handleProceedToRanking = () => {
    if (selectedEntries.length !== 5) {
      setAlert({
        isOpen: true,
        title: 'Selection Incomplete',
        message: 'Please select exactly 5 sweaters to proceed to ranking.',
        variant: 'warning'
      });
      return;
    }
    setRankedEntries([...selectedEntries]);
    setIsRankingMode(true);
  };

  const handleBackToSelection = () => {
    setIsRankingMode(false);
    setRankedEntries([]);
  };

  const moveEntryUp = (index: number) => {
    if (index === 0) return;
    const newRanked = [...rankedEntries];
    [newRanked[index], newRanked[index - 1]] = [newRanked[index - 1], newRanked[index]];
    setRankedEntries(newRanked);
  };

  const moveEntryDown = (index: number) => {
    if (index === rankedEntries.length - 1) return;
    const newRanked = [...rankedEntries];
    [newRanked[index], newRanked[index + 1]] = [newRanked[index + 1], newRanked[index]];
    setRankedEntries(newRanked);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    setDraggedOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && draggedOverIndex !== null && draggedIndex !== draggedOverIndex) {
      const newRanked = [...rankedEntries];
      const [removed] = newRanked.splice(draggedIndex, 1);
      newRanked.splice(draggedOverIndex, 0, removed);
      setRankedEntries(newRanked);
    }
    setDraggedIndex(null);
    setDraggedOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSubmitRankings = async () => {
    if (!voterName || rankedEntries.length !== 5) {
      setAlert({
        isOpen: true,
        title: 'Cannot Submit',
        message: 'Please rank all 5 selected sweaters.',
        variant: 'warning'
      });
      return;
    }

    try {
      setSubmitting(true);
      
      await Promise.all(
        rankedEntries.map((entryId, index) =>
          rankingVoteService.submit({
            voter_name: voterName,
            entry_id: entryId,
            rank: index + 1,
          })
        )
      );

      setAlert({
        isOpen: true,
        title: 'Success!',
        message: 'Your sweater rankings have been submitted successfully!',
        variant: 'success'
      });

      await loadVoterRankingsForEntries(voterName, entries);
    } catch (error) {
      console.error('Error submitting rankings:', error);
      setAlert({
        isOpen: true,
        title: 'Submission Error',
        message: 'Failed to submit rankings. Please try again.',
        variant: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getEntryById = (id: number): Entry | undefined => {
    return entries.find(e => e.id === id);
  };

  const getRankEmoji = (rank: number): string => {
    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    return emojis[rank - 1] || '⭐';
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

        {/* View Toggle - Styled as integrated tabs */}
        <div className="bg-white rounded-t-xl shadow-sm border-b-2 border-gray-200 mb-0">
          <nav className="flex -mb-px">
            <button
              onClick={() => setCurrentView('submit')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 ${
                currentView === 'submit'
                  ? 'border-b-4 border-indigo-600 text-indigo-600 bg-indigo-50'
                  : 'border-b-4 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center justify-center gap-2 text-lg">
                <span>🎁</span>
                <span>Submit Entry</span>
              </span>
            </button>
            <button
              onClick={() => setCurrentView('vote')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 ${
                currentView === 'vote'
                  ? 'border-b-4 border-indigo-600 text-indigo-600 bg-indigo-50'
                  : 'border-b-4 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center justify-center gap-2 text-lg">
                <span>🗳️</span>
                <span>Vote</span>
              </span>
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-lg">
          {currentView === 'submit' && (
            <div className="p-6">
              <ContestEntryForm
                contestId={contestId!}
                contest={contest}
                onSubmit={handleEntrySubmit}
                loading={submitting}
              />
            </div>
          )}

          {currentView === 'vote' && (
            <div className="p-6">
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
            ) : contest?.contest_type === 'sweater' ? (
              // Sweater ranking UI
              <div>
                {!isRankingMode ? (
                  // Selection mode
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold mb-2">🎯 Select Your Top 5</h2>
                          <p className="text-blue-50">Choose your 5 favorite sweaters, then rank them!</p>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold">{selectedEntries.length}/5</div>
                          <div className="text-sm text-blue-100">Selected</div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="w-full bg-blue-400 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-yellow-300 h-3 transition-all duration-500 ease-out"
                            style={{ width: `${(selectedEntries.length / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {selectedEntries.length === 5 && (
                      <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Check className="w-6 h-6 text-green-600" />
                          <span className="text-green-800 font-semibold">All 5 selected! Ready to rank?</span>
                        </div>
                        <Button 
                          onClick={handleProceedToRanking} 
                          variant="primary"
                          className="w-full sm:w-auto"
                        >
                          Proceed to Ranking →
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {entries.map((entry, index) => {
                        const selectionIndex = selectedEntries.indexOf(entry.id);
                        const isSelected = selectionIndex !== -1;
                        const selectionNumber = isSelected ? selectionIndex + 1 : null;

                        return (
                          <div
                            key={entry.id}
                            onClick={() => handleEntrySelect(entry.id)}
                            className={`relative rounded-xl overflow-hidden shadow-md transition-all duration-300 cursor-pointer
                              ${isSelected 
                                ? 'ring-4 ring-green-500 scale-105 shadow-xl' 
                                : 'hover:ring-2 hover:ring-blue-400 hover:scale-102 hover:shadow-lg'
                              }
                              ${!isSelected && selectedEntries.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <div className="aspect-square relative">
                              <img
                                src={entry.photo}
                                alt={entry.entry_name}
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <>
                                  <div className="absolute inset-0 bg-green-500 bg-opacity-20 pointer-events-none" />
                                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg animate-bounce">
                                    {selectionNumber}
                                  </div>
                                  <div className="absolute bottom-2 left-2 bg-green-500 text-white rounded-full p-2 shadow-lg">
                                    <Check className="w-5 h-5" />
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="p-3 bg-white">
                              <h3 className="font-semibold text-gray-900 truncate">{entry.entry_name}</h3>
                              <p className="text-sm text-gray-600 truncate">{entry.contestant_name}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Ranking mode
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl p-6 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold mb-2">
                            <Trophy className="inline w-7 h-7 mr-2 animate-pulse" />
                            Rank Your Top 5
                          </h2>
                          <p className="text-purple-100">Drag to reorder or use the arrow buttons</p>
                        </div>
                        <Button onClick={handleBackToSelection} variant="ghost" className="text-white hover:bg-white/20">
                          ← Back to Selection
                        </Button>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 flex items-start gap-3">
                      <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">How to rank:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                          <li>Drag entries to reorder them (desktop)</li>
                          <li>Use ↑↓ buttons to move entries (mobile-friendly)</li>
                          <li>#1 = Your favorite, #5 = Your fifth favorite</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {rankedEntries.map((entryId, index) => {
                        const entry = getEntryById(entryId);
                        if (!entry) return null;

                        const isDragging = draggedIndex === index;
                        const isDropTarget = draggedOverIndex === index;

                        return (
                          <div
                            key={entryId}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            className={`
                              bg-white rounded-xl shadow-md overflow-hidden transition-all duration-200
                              ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
                              ${isDropTarget ? 'ring-4 ring-blue-400 scale-102' : ''}
                              hover:shadow-lg cursor-move
                            `}
                          >
                            <div className="flex items-center gap-4 p-4">
                              <div className="flex-shrink-0 text-4xl font-bold w-16 text-center">
                                {getRankEmoji(index + 1)}
                              </div>
                              <div className="flex-shrink-0">
                                <GripVertical className="w-6 h-6 text-gray-400" />
                              </div>
                              <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                                <img
                                  src={entry.photo}
                                  alt={entry.entry_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-grow min-w-0">
                                <h3 className="font-bold text-lg text-gray-900 truncate">{entry.entry_name}</h3>
                                <p className="text-gray-600 truncate">{entry.contestant_name}</p>
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                                    Rank #{index + 1}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => moveEntryUp(index)}
                                  disabled={index === 0}
                                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  aria-label="Move up"
                                >
                                  <ChevronUp className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => moveEntryDown(index)}
                                  disabled={index === rankedEntries.length - 1}
                                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  aria-label="Move down"
                                >
                                  <ChevronDown className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-center pt-6">
                      <Button
                        onClick={handleSubmitRankings}
                        disabled={submitting || rankedEntries.length !== 5}
                        size="lg"
                        className="px-8 py-4 text-lg"
                      >
                        {submitting ? (
                          <>
                            <LoadingSpinner size="sm" className="mr-2" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Star className="w-5 h-5 mr-2" />
                            Submit My Rankings
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Regular rating UI for other contests
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
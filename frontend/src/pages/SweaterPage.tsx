import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageIcon, Trophy, Star, ArrowLeft, ChevronUp, ChevronDown, Check, Info } from 'lucide-react';
import { Entry, ContestWithEvent } from '@/types';
import { Button, LoadingSpinner, AlertDialog } from '@/components/common';
import { MenuBar } from '@/components/common';
import { entryService, contestService, rankingVoteService } from '@/services/api';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const SweaterPage: React.FC = () => {
  const navigate = useNavigate();

  const [sweaterContest, setSweaterContest] = useState<ContestWithEvent | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Voter state
  const [voterName, setVoterName] = useLocalStorage<string>('sweater-voter-name', '');
  const [isVoterNameSubmitted, setIsVoterNameSubmitted] = useState(false);
  
  // Selection and ranking state
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [rankedEntries, setRankedEntries] = useState<number[]>([]);
  const [isRankingMode, setIsRankingMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    loadSweaterContest();
  }, []);

  useEffect(() => {
    if (voterName && voterName.trim().length >= 2) {
      loadVoterRankings(voterName);
    }
  }, [voterName]);

  const loadSweaterContest = async () => {
    try {
      setLoading(true);
      
      // Get all active contests and find the sweater contest
      const activeContests = await contestService.getActive();
      const sweater = activeContests.find(c => c.contest_type === 'sweater');
      
      if (!sweater) {
        setAlert({
          isOpen: true,
          title: 'No Sweater Contest',
          message: 'No active sweater contest found. Please create one first.',
          variant: 'warning'
        });
        setLoading(false);
        return;
      }

      setSweaterContest(sweater);
      
      // Load entries for the sweater contest
      const entriesData = await entryService.getByContest(sweater.id);
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading sweater contest:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load sweater contest data.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVoterRankings = async (voter: string) => {
    try {
      const rankings = await rankingVoteService.getByVoter(voter);
      
      // If voter has existing rankings, populate the selected and ranked entries
      const rankedEntryIds = Object.entries(rankings)
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([entryId]) => parseInt(entryId));
      
      if (rankedEntryIds.length > 0) {
        setSelectedEntries(rankedEntryIds);
        setRankedEntries(rankedEntryIds);
        setIsRankingMode(rankedEntryIds.length === 5);
      }
    } catch (error) {
      console.error('Error loading rankings:', error);
    }
  };

  const handleVoterNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (voterName.trim().length >= 2) {
      setIsVoterNameSubmitted(true);
    } else {
      setAlert({
        isOpen: true,
        title: 'Invalid Name',
        message: 'Please enter at least 2 characters for your name.',
        variant: 'warning'
      });
    }
  };

  const handleVoterLogout = () => {
    setVoterName('');
    setIsVoterNameSubmitted(false);
    setSelectedEntries([]);
    setRankedEntries([]);
    setIsRankingMode(false);
  };

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
      
      // Submit all rankings
      await Promise.all(
        rankedEntries.map((entryId, index) =>
          rankingVoteService.submit({
            voter_name: voterName,
            entry_id: entryId,
            rank: index + 1, // Rank 1-5 (1 is best)
          })
        )
      );

      setAlert({
        isOpen: true,
        title: 'Success!',
        message: 'Your sweater rankings have been submitted successfully!',
        variant: 'success'
      });

      // Reload rankings
      await loadVoterRankings(voterName);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-blue-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!sweaterContest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">🧥 Sweater Contest</h1>
            <p className="text-gray-600 mb-6">No active sweater contest found.</p>
            <Button onClick={() => navigate('/')} variant="primary">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Voter name form
  if (!isVoterNameSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4 animate-bounce">🧥</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-3">
              Sweater Contest
            </h1>
            <div className="bg-gradient-to-r from-red-100 via-green-100 to-blue-100 rounded-lg p-4 mb-4">
              <p className="text-gray-700 text-lg font-semibold mb-2">
                How it works:
              </p>
              <ol className="text-left text-gray-600 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-red-500 flex-shrink-0">1.</span>
                  <span>Browse all sweater entries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-500 flex-shrink-0">2.</span>
                  <span>Select your top 5 favorites</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-500 flex-shrink-0">3.</span>
                  <span>Rank them from best to 5th place</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-purple-500 flex-shrink-0">4.</span>
                  <span>Submit your rankings!</span>
                </li>
              </ol>
            </div>
          </div>

          <form onSubmit={handleVoterNameSubmit} className="space-y-6">
            <div>
              <label htmlFor="voterName" className="block text-sm font-semibold text-gray-700 mb-3">
                👤 Enter your name to begin:
              </label>
              <input
                id="voterName"
                type="text"
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                placeholder="Your name (at least 2 characters)"
                className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                autoFocus
                required
                minLength={2}
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Use the same name if you want to edit your rankings later
              </p>
            </div>

            <Button type="submit" variant="primary" className="w-full text-lg py-4 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
              <Trophy className="w-5 h-5 mr-2" />
              Start Ranking Sweaters
            </Button>

            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Main ranking interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-blue-50">
      <MenuBar
        title={`🧥 Sweater Contest: ${voterName}`}
        subtitle={sweaterContest.event_name}
        actions={[
          {
            label: 'Change voter',
            onClick: handleVoterLogout,
            variant: 'ghost',
            icon: '👤'
          },
          {
            label: 'Back to Home',
            onClick: () => navigate('/'),
            variant: 'ghost',
            icon: '🏠'
          }
        ]}
      />

      <div className="max-w-7xl mx-auto p-6">
        {!isRankingMode ? (
          // Selection Mode
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                    Select Your Top 5 Sweaters
                  </h2>
                  <div className="flex items-center gap-3 text-gray-600">
                    <span className="text-lg font-semibold">
                      {selectedEntries.length}/5 selected
                    </span>
                    {selectedEntries.length < 5 && (
                      <span className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                        <Info className="w-4 h-4 inline mr-1" />
                        Click sweaters to select
                      </span>
                    )}
                    {selectedEntries.length === 5 && (
                      <span className="text-sm bg-green-50 text-green-600 px-3 py-1 rounded-full animate-pulse">
                        <Check className="w-4 h-4 inline mr-1" />
                        Ready to rank!
                      </span>
                    )}
                  </div>
                </div>
                {selectedEntries.length === 5 && (
                  <Button 
                    onClick={handleProceedToRanking} 
                    variant="primary" 
                    size="lg"
                    className="w-full md:w-auto shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    <Trophy className="w-5 h-5 mr-2" />
                    Proceed to Rank
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              <div className="relative w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-4 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(selectedEntries.length / 5) * 100}%` }}
                />
                {selectedEntries.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white drop-shadow-lg">
                      {selectedEntries.length === 5 ? '🎉 All 5 Selected!' : `${5 - selectedEntries.length} more to go`}
                    </span>
                  </div>
                )}
              </div>

              {/* Clear selection button */}
              {selectedEntries.length > 0 && (
                <div className="text-center">
                  <button
                    onClick={() => setSelectedEntries([])}
                    className="text-sm text-red-600 hover:text-red-700 underline"
                  >
                    Clear all selections
                  </button>
                </div>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">No sweater entries yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {entries.map((entry) => {
                  const isSelected = selectedEntries.includes(entry.id);
                  const selectionIndex = selectedEntries.indexOf(entry.id);
                  const canSelect = !isSelected && selectedEntries.length < 5;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleEntrySelect(entry.id)}
                      className={`bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all duration-300 transform ${
                        isSelected 
                          ? 'ring-4 ring-green-500 scale-105 shadow-2xl' 
                          : canSelect 
                            ? 'hover:scale-105 hover:shadow-xl ring-2 ring-transparent hover:ring-gray-300' 
                            : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={entry.photo}
                          alt={entry.entry_name}
                          className={`w-full h-64 object-cover transition-all ${
                            isSelected ? '' : canSelect ? '' : 'grayscale'
                          }`}
                        />
                        
                        {/* Selection badge */}
                        {isSelected && (
                          <>
                            <div className="absolute inset-0 bg-green-500 bg-opacity-20"></div>
                            <div className="absolute top-4 right-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full w-16 h-16 flex flex-col items-center justify-center font-bold text-xl shadow-2xl border-4 border-white animate-bounce">
                              <span className="text-xs font-normal">Pick</span>
                              <span>#{selectionIndex + 1}</span>
                            </div>
                            <div className="absolute top-4 left-4 bg-green-500 text-white rounded-full p-2 shadow-lg">
                              <Check className="w-6 h-6" />
                            </div>
                          </>
                        )}

                        {/* Hover hint */}
                        {!isSelected && canSelect && (
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <span className="opacity-0 hover:opacity-100 transition-opacity bg-white text-gray-800 px-4 py-2 rounded-full font-semibold shadow-lg">
                              Click to select
                            </span>
                          </div>
                        )}

                        {/* Max selections hint */}
                        {!isSelected && !canSelect && (
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                            <span className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold shadow-lg text-sm">
                              Max 5 selections
                            </span>
                          </div>
                        )}
                      </div>
                      <div className={`p-4 ${isSelected ? 'bg-green-50' : ''}`}>
                        <h3 className="font-bold text-lg text-gray-800 mb-1">
                          {entry.entry_name}
                        </h3>
                        <p className="text-gray-600 text-sm">by {entry.contestant_name}</p>
                        {isSelected && (
                          <div className="mt-2 text-xs text-green-600 font-semibold flex items-center">
                            <Check className="w-4 h-4 mr-1" />
                            Selected #{selectionIndex + 1} - Click to remove
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Ranking Mode
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3">
                    🏆 Rank Your Top 5 Sweaters
                  </h2>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-blue-800 font-semibold mb-2">
                      Use the ↑↓ buttons to arrange from best to 5th place:
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm text-blue-700">
                      <span className="bg-white px-2 py-1 rounded">🥇 = Your favorite</span>
                      <span className="bg-white px-2 py-1 rounded">🥈 = 2nd best</span>
                      <span className="bg-white px-2 py-1 rounded">🥉 = 3rd best</span>
                      <span className="bg-white px-2 py-1 rounded">4️⃣ = 4th</span>
                      <span className="bg-white px-2 py-1 rounded">5️⃣ = 5th</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={handleBackToSelection} variant="ghost" className="order-2 sm:order-1">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Change Selection
                  </Button>
                  <Button
                    onClick={handleSubmitRankings}
                    variant="primary"
                    size="lg"
                    disabled={submitting}
                    className="order-1 sm:order-2 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    {submitting ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Star className="w-5 h-5 mr-2" />
                        Submit Rankings
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {rankedEntries.map((entryId, index) => {
                const entry = getEntryById(entryId);
                if (!entry) return null;

                const isFirst = index === 0;
                const isLast = index === rankedEntries.length - 1;
                const rankColor = index === 0 ? 'from-yellow-400 to-yellow-600' :
                                 index === 1 ? 'from-gray-300 to-gray-500' :
                                 index === 2 ? 'from-orange-400 to-orange-600' :
                                 'from-blue-400 to-blue-600';

                return (
                  <div
                    key={entryId}
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row items-stretch">
                      {/* Rank badge */}
                      <div className={`bg-gradient-to-br ${rankColor} w-full sm:w-24 flex-shrink-0 flex items-center justify-center text-5xl font-bold text-white py-4 sm:py-6 relative`}>
                        <div className="text-center">
                          <div>{getRankEmoji(index + 1)}</div>
                          <div className="text-xs font-normal mt-1 opacity-90">
                            {index === 0 ? 'BEST' : index === 1 ? '2ND' : index === 2 ? '3RD' : `${index + 1}TH`}
                          </div>
                        </div>
                      </div>
                      
                      {/* Entry info */}
                      <div className="flex-1 flex flex-col sm:flex-row items-center p-4 gap-4">
                        <img
                          src={entry.photo}
                          alt={entry.entry_name}
                          className="w-full sm:w-32 h-32 object-cover rounded-lg shadow-md"
                        />
                        <div className="flex-1 text-center sm:text-left">
                          <h3 className="font-bold text-xl text-gray-800 mb-1">
                            {entry.entry_name}
                          </h3>
                          <p className="text-gray-600 mb-2">by {entry.contestant_name}</p>
                          <div className="text-sm text-gray-500">
                            {isFirst && '👑 Your top pick!'}
                            {!isFirst && !isLast && `Want to move ${index === 1 ? 'to 1st place' : 'up or down'}?`}
                            {isLast && '💡 Move up to rank higher'}
                          </div>
                        </div>
                      </div>

                      {/* Move buttons */}
                      <div className="flex sm:flex-col justify-center gap-2 p-4 bg-gray-50 border-t sm:border-t-0 sm:border-l border-gray-200">
                        <Button
                          onClick={() => moveEntryUp(index)}
                          disabled={isFirst}
                          variant={isFirst ? 'ghost' : 'secondary'}
                          size="lg"
                          className={`flex-1 sm:flex-none ${!isFirst && 'hover:bg-green-500 hover:text-white'}`}
                          title={isFirst ? "Already at the top!" : "Move up one position"}
                        >
                          <ChevronUp className="w-6 h-6" />
                          <span className="ml-2 hidden lg:inline">Up</span>
                        </Button>
                        <Button
                          onClick={() => moveEntryDown(index)}
                          disabled={isLast}
                          variant={isLast ? 'ghost' : 'secondary'}
                          size="lg"
                          className={`flex-1 sm:flex-none ${!isLast && 'hover:bg-blue-500 hover:text-white'}`}
                          title={isLast ? "Already at the bottom!" : "Move down one position"}
                        >
                          <ChevronDown className="w-6 h-6" />
                          <span className="ml-2 hidden lg:inline">Down</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </div>
  );
};

export default SweaterPage;


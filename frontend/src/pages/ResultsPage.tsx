import React, { useState, useEffect, useCallback } from 'react';
import { EntryResult, VoterInfo, ContestWithEvent } from '@/types';
import { PasswordForm, ResultCard, VoterManagement } from '@/components/results';
import { MenuBar, ConfirmDialog, AlertDialog, LoadingSpinner } from '@/components/common';
import { RESULTS_PASSWORD } from '@/utils/constants';
import { entryService, voterService, contestService } from '@/services/api';

const ResultsPage: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [resultsData, setResultsData] = useState<EntryResult[]>([]);
  const [votersData, setVotersData] = useState<VoterInfo[]>([]);
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'voters'>('results');
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const loadContests = useCallback(async () => {
    try {
      const activeContests = await contestService.getActive();
      setContests(activeContests);
    } catch (error) {
      console.error('Error loading contests:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [results, voters] = await Promise.all([
        entryService.getResults(selectedContestId || undefined),
        voterService.getAll(),
      ]);
      setResultsData(results);
      setVotersData(voters);
    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({
        isOpen: true,
        title: 'Loading Error',
        message: 'Failed to load data. Make sure the server is running.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedContestId]);

  const handlePasswordSubmit = (password: string) => {
    // Clear any existing alerts first
    setAlert({ isOpen: false, title: '', message: '' });

    if (password === RESULTS_PASSWORD) {
      setIsAuthorized(true);
      loadData();
    } else {
      // Small delay to ensure the clear happens first
      setTimeout(() => {
        setAlert({
          isOpen: true,
          title: 'Invalid Password',
          message: 'Incorrect password. Please try again.',
          variant: 'error'
        });
      }, 50);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadContests();
    }
  }, [isAuthorized, loadContests]);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [selectedContestId, isAuthorized, loadData]);

  const handleDeleteEntry = (entryId: number, entryName: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Entry',
      message: `Are you sure you want to delete "${entryName}"?\n\nThis will permanently delete:\n- The entry\n- All votes for this entry\n- The uploaded photo\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        try {
          await entryService.delete(entryId);
          setAlert({
            isOpen: true,
            title: 'Success',
            message: 'Entry deleted successfully!',
            variant: 'success'
          });
          await loadData();
        } catch (error) {
          console.error('Error deleting entry:', error);
          setAlert({
            isOpen: true,
            title: 'Delete Error',
            message: 'Failed to delete entry. Please try again.',
            variant: 'error'
          });
        }
      }
    });
  };

  const handleUpdateVoterName = async (oldName: string, newName: string) => {
    try {
      await voterService.updateName(oldName, newName);
      setAlert({
        isOpen: true,
        title: 'Success',
        message: `Voter name updated from "${oldName}" to "${newName}"!`,
        variant: 'success'
      });
      await loadData();
    } catch (error) {
      console.error('Error updating voter name:', error);
      setAlert({
        isOpen: true,
        title: 'Update Error',
        message: 'Failed to update voter name. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleDeleteVoter = (voterName: string, voteCount: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Voter',
      message: `Are you sure you want to delete voter "${voterName}"?\n\nThis will permanently delete:\n- The voter\n- All ${voteCount} votes by this voter\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        try {
          await voterService.delete(voterName);
          setAlert({
            isOpen: true,
            title: 'Success',
            message: `Voter "${voterName}" and all their votes deleted successfully!`,
            variant: 'success'
          });
          await loadData();
        } catch (error) {
          console.error('Error deleting voter:', error);
          setAlert({
            isOpen: true,
            title: 'Delete Error',
            message: 'Failed to delete voter. Please try again.',
            variant: 'error'
          });
        }
      }
    });
  };

  const handleLock = () => {
    setIsAuthorized(false);
    setResultsData([]);
    setVotersData([]);
  };

  const getContestEmoji = (contestType: string) => {
    switch (contestType) {
      case 'dessert': return '🍰';
      case 'cocktail': return '🍹';
      case 'appetizer': return '🥗';
      case 'sweater': return '🧥';
      default: return '🎯';
    }
  };

  if (!isAuthorized) {
    return <PasswordForm onSubmit={handlePasswordSubmit} />;
  }

  return (
    <div>
      <MenuBar
        title="🎄 Contest Results"
        subtitle="Admin controls are enabled. You can delete entries permanently."
        status={{
          text: "🛡️ Admin Mode",
          variant: "error"
        }}
        actions={[
          {
            label: "Lock Results",
            onClick: handleLock,
            variant: "ghost",
            icon: "🔒"
          }
        ]}
      />

      {/* Contest Filter */}
      {contests.length > 1 && (
        <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Contest:
          </label>
          <select
            value={selectedContestId || ''}
            onChange={(e) => setSelectedContestId(e.target.value ? e.target.value : null)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Contests</option>
            {contests.map((contest) => (
              <option key={contest.id} value={contest.id}>
                {getContestEmoji(contest.contest_type)} {contest.contest_name} - {contest.event_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('results')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'results'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏆 Results
            </button>
            <button
              onClick={() => setActiveTab('voters')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'voters'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Voters
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <LoadingSpinner size="lg" className="mx-auto mb-4 text-indigo-600" />
          <p className="text-lg text-gray-700">Loading results...</p>
          <p className="text-sm text-gray-500 mt-2">🏆 Calculating scores and rankings</p>
        </div>
      ) : activeTab === 'voters' ? (
        <VoterManagement
          voters={votersData}
          onDeleteVoter={handleDeleteVoter}
          onUpdateVoterName={handleUpdateVoterName}
        />
      ) : (
        <div>
          {(() => {
            if (resultsData.length === 0) {
              return (
                <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                  <p className="text-gray-600 text-lg">
                    No entries yet
                  </p>
                  <p className="text-gray-400">Entries will appear here once submitted!</p>
                </div>
              );
            }

            // Group by contest
            const resultsByContest: { [contestId: string]: EntryResult[] } = {};
            resultsData.forEach(entry => {
              if (!resultsByContest[entry.contest_id]) {
                resultsByContest[entry.contest_id] = [];
              }
              resultsByContest[entry.contest_id].push(entry);
            });

            return (
              <div className="space-y-8">
                {Object.entries(resultsByContest).map(([contestIdStr, contestResults]) => {
                  const contest = contests.find(c => c.id === contestIdStr);
                  const contestEmoji = getContestEmoji(contest?.contest_type || '');
                  const isSweaterContest = contest?.contest_type === 'sweater';

                  return (
                    <div key={contestIdStr} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="border-b border-gray-200 pb-4 mb-6">
                        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                          <span className="text-3xl">{contestEmoji}</span>
                          <div>
                            <div className="flex items-center gap-3">
                              <span>{contest?.contest_name || 'Unknown Contest'}</span>
                              {isSweaterContest && (
                                <span className="text-xs bg-gradient-to-r from-red-100 via-green-100 to-blue-100 text-gray-700 px-3 py-1 rounded-full font-semibold">
                                  Ranking System
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-normal text-gray-600 mt-1">
                              📅 {contest?.event_name} • {contestResults.length} entries
                            </div>
                          </div>
                        </h3>
                        {isSweaterContest && (
                          <div className="mt-3 bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                            <p className="text-xs text-blue-800">
                              <strong>ℹ️ Note:</strong> This contest uses a ranking system where voters select their top 5 and rank them. 
                              Results show aggregate scores based on rankings (1st place = 5 points, 2nd = 4, etc.).
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        {contestResults.map((entry, index) => (
                          <ResultCard
                            key={entry.id}
                            entry={entry}
                            rank={index + 1}
                            onDelete={handleDeleteEntry}
                            showAdminControls={true}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Dialogs */}
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />

      <ConfirmDialog
        isOpen={confirmation.isOpen}
        onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default ResultsPage;

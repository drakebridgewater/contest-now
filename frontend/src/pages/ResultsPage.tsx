import React, { useState } from 'react';
import { EntryResult, VoterInfo, ContestType } from '@/types';
import { PasswordForm, ResultCard, VoterManagement } from '@/components/results';
import { Button } from '@/components/common';
import { RESULTS_PASSWORD, CONTEST_TYPES } from '@/utils/constants';
import { entryService, voterService } from '@/services/api';

const ResultsPage: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [resultsData, setResultsData] = useState<EntryResult[]>([]);
  const [votersData, setVotersData] = useState<VoterInfo[]>([]);
  const [activeTab, setActiveTab] = useState<ContestType | 'voters'>('appetizer');
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = (password: string) => {
    if (password === RESULTS_PASSWORD) {
      setIsAuthorized(true);
      loadData();
    } else {
      alert('Incorrect password');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [results, voters] = await Promise.all([
        entryService.getResults(),
        voterService.getAll(),
      ]);
      setResultsData(results);
      setVotersData(voters);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: number, entryName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${entryName}"?\n\n` +
      `This will permanently delete:\n` +
      `- The entry\n` +
      `- All votes for this entry\n` +
      `- The uploaded photo\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await entryService.delete(entryId);
      alert('Entry deleted successfully!');
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleDeleteVoter = async (voterName: string, voteCount: number) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete voter "${voterName}"?\n\n` +
      `This will permanently delete:\n` +
      `- The voter\n` +
      `- All ${voteCount} votes by this voter\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await voterService.delete(voterName);
      alert(`Voter "${voterName}" and all their votes deleted successfully!`);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error deleting voter:', error);
      alert('Failed to delete voter. Please try again.');
    }
  };

  const handleLock = () => {
    setIsAuthorized(false);
    setResultsData([]);
    setVotersData([]);
  };

  if (!isAuthorized) {
    return <PasswordForm onSubmit={handlePasswordSubmit} />;
  }

  const contestTabs = [
    { id: 'appetizer', name: '🥗 Appetizers', emoji: '🥗' },
    { id: 'cocktail', name: '🍹 Cocktails', emoji: '🍹' },
    { id: 'dessert', name: '🍰 Desserts', emoji: '🍰' },
    { id: 'voters', name: '👥 Voters', emoji: '👥' },
  ] as const;

  return (
    <div>
      {/* Admin Header */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            🎄 PDXmas Contest Results
          </h2>
          <div className="flex gap-3">
            <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
              🛡️ Admin Mode
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLock}
              className="text-sm underline"
            >
              🔒 Lock Results
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Admin controls are enabled. You can delete entries permanently.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {contestTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ContestType | 'voters')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 mx-auto mb-4 text-indigo-600">⭐</div>
          <p>Loading results...</p>
        </div>
      ) : activeTab === 'voters' ? (
        <VoterManagement
          voters={votersData}
          onDeleteVoter={handleDeleteVoter}
        />
      ) : (
        <div>
          {(() => {
            const contestResults = resultsData.filter(entry => entry.contest_type === activeTab);

            if (contestResults.length === 0) {
              return (
                <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                  <p className="text-gray-600 text-lg">
                    No {CONTEST_TYPES[activeTab as ContestType]?.name} entries yet
                  </p>
                  <p className="text-gray-400">Entries will appear here once submitted!</p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
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
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
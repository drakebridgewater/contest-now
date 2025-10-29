import React, { useState } from 'react';
import { EntryResult, VoterInfo, ContestType } from '@/types';
import { PasswordForm, ResultCard, VoterManagement } from '@/components/results';
import { MenuBar, ConfirmDialog, AlertDialog, LoadingSpinner } from '@/components/common';
import { RESULTS_PASSWORD, CONTEST_TYPES } from '@/utils/constants';
import { entryService, voterService } from '@/services/api';

const ResultsPage: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [resultsData, setResultsData] = useState<EntryResult[]>([]);
  const [votersData, setVotersData] = useState<VoterInfo[]>([]);
  const [activeTab, setActiveTab] = useState<ContestType | 'voters'>('appetizer');
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
      setAlert({
        isOpen: true,
        title: 'Loading Error',
        message: 'Failed to load data. Make sure the server is running.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

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
      <MenuBar
        title="🎄 PDXmas Contest Results"
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
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <LoadingSpinner size="lg" className="mx-auto mb-4 text-indigo-600" />
          <p className="text-lg text-gray-700">Loading results...</p>
          <p className="text-sm text-gray-500 mt-2">🏆 Calculating scores and rankings</p>
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
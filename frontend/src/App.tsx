import React, {useCallback, useEffect, useState} from 'react';
import {Entry, PageType, VotesByVoter} from '@/types';
import {Button} from '@/components/common';
import {ResultsPage, SubmitPage, VotePage} from '@/pages';
import {entryService, voteService} from '@/services/api';
import {useLocalStorage} from '@/hooks/useLocalStorage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('submit');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [votes, setVotes] = useLocalStorage<{[voterName: string]: VotesByVoter}>('contest-votes', {});
  const [voterName, setVoterName] = useLocalStorage<string>('contest-voter-name', '');
  const [isVoterNameSubmitted, setIsVoterNameSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const loadVotes = useCallback(async (voter: string): Promise<void> => {
    if (!voter) return;

    console.log('loadVotes called for voter:', voter);
    try {
      const data = await voteService.getByVoter(voter);
      setVotes(prev => ({...prev, [voter]: data}));
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  }, [setVotes]);

  // Load entries on mount
  useEffect(() => {
    loadEntries();
  }, []);

  // Initialize voter state from localStorage
  useEffect(() => {
    if (voterName && voterName.trim().length >= 2) {
      setIsVoterNameSubmitted(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadVotes(voterName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterName]); // loadVotes intentionally omitted to prevent infinite loop

  const loadEntries = async (): Promise<void> => {
    console.log('loadEntries called');
    try {
      setLoading(true);
      const data = await entryService.getAll();
      setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
      alert('Failed to load entries. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoterNameSubmit = (name: string): void => {
    setVoterName(name);
    setIsVoterNameSubmitted(true);
    loadVotes(name);

    if (!votes[name]) {
      setVotes(prev => ({...prev, [name]: {}}));
    }
  };

  const handleVoterLogout = (): void => {
    setVoterName('');
    setIsVoterNameSubmitted(false);
  };

  const handleVoteChange = (voterName: string, entryId: number, ratingType: string, rating: number): void => {
    setVotes(prev => {
      const updatedVotes = {...prev};
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
      updatedVotes[voterName][entryId] = {
        ...updatedVotes[voterName][entryId],
        [ratingType]: rating,
      };
      return updatedVotes;
    });
  };

  const handleCommentChange = (voterName: string, entryId: number, comment: string): void => {
    setVotes(prev => {
      const updatedVotes = {...prev};
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
      updatedVotes[voterName][entryId] = {
        ...updatedVotes[voterName][entryId],
        comment,
      };
      return updatedVotes;
    });
  };

  const handleEntrySubmitted = (): void => {
    loadEntries();
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🎄</div>
          <p className="text-gray-600">Loading PDXmas Contest...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-green-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
            <span className="text-4xl">🎄</span>PDXmas 2025<span className="text-4xl">❄️</span>
          </h1>
          <div className="flex gap-4">
            <Button
              onClick={() => setCurrentPage('submit')}
              variant={currentPage === 'submit' ? 'secondary' : 'ghost'}
              className={
                currentPage === 'submit'
                  ? 'bg-white text-red-700 shadow-lg'
                  : 'bg-red-600 bg-opacity-20 text-white hover:bg-opacity-30'
              }
            >
              🎁 Submit Entry
            </Button>
            <Button
              onClick={() => setCurrentPage('vote')}
              variant={currentPage === 'vote' ? 'secondary' : 'ghost'}
              className={
                currentPage === 'vote'
                  ? 'bg-white text-green-700 shadow-lg'
                  : 'bg-green-600 bg-opacity-20 text-white hover:bg-opacity-30'
              }
            >
              🗳️ Vote
            </Button>
            <Button
              onClick={() => setCurrentPage('results')}
              variant={currentPage === 'results' ? 'secondary' : 'ghost'}
              className={
                currentPage === 'results'
                  ? 'bg-white text-red-700 shadow-lg'
                  : 'bg-red-600 bg-opacity-20 text-white hover:bg-opacity-30'
              }
            >
              🏆 Results
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'submit' && (
          <SubmitPage onEntrySubmitted={handleEntrySubmitted} />
        )}

        {currentPage === 'vote' && (
          <VotePage
            entries={entries}
            voterName={voterName}
            isVoterNameSubmitted={isVoterNameSubmitted}
            votes={votes}
            onVoterNameSubmit={handleVoterNameSubmit}
            onVoterLogout={handleVoterLogout}
            onVoteChange={handleVoteChange}
            onCommentChange={handleCommentChange}
          />
        )}

        {currentPage === 'results' && <ResultsPage />}
      </div>
    </div>
  );
};

export default App;

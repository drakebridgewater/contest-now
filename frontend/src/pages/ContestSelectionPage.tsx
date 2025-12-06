import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContestWithEvent } from '@/types';
import { LoadingSpinner } from '@/components/common';
import { Layout } from '@/components/layout';
import { contestService } from '@/services/api';
import { formatDate } from '@/utils/helpers';

const ContestSelectionPage: React.FC = () => {
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const activeContests = await contestService.getActive();
        setContests(activeContests);
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load contests. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getContestEmoji = (contestType: string) => {
    switch (contestType) {
      case 'dessert': return '🍰';
      case 'cocktail': return '🍹';
      case 'appetizer': return '🥗';
      case 'other': return '🏆';
      default: return '🎯';
    }
  };

  const getContestColor = (contestType: string) => {
    switch (contestType) {
      case 'dessert': return 'from-pink-400 to-red-400';
      case 'cocktail': return 'from-blue-400 to-purple-400';
      case 'appetizer': return 'from-green-400 to-teal-400';
      case 'other': return 'from-yellow-400 to-orange-400';
      default: return 'from-gray-400 to-slate-400';
    }
  };

  const handleContestSelect = (contestId: string) => {
    navigate(`/contest/${contestId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4 text-green-600" />
            <p className="text-gray-600 text-lg">Loading contests...</p>
            <p className="text-gray-500 text-sm mt-2">🎄 Getting ready for the holidays! ❄️</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Error Loading Contests</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (contests.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No Active Contests</h2>
            <p className="text-gray-600">There are no active contests at the moment. Please check back later!</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3 justify-center">
            <span className="text-5xl">🎄</span>
            PDXmas 2025 Contests
            <span className="text-5xl">❄️</span>
          </h1>
          <p className="text-gray-600 text-center text-lg">Choose a contest to participate in</p>
        </div>
      </div>


      {/* Contest Selection Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {contests.map((contest) => (
            <div
              key={contest.id}
              onClick={() => handleContestSelect(contest.id)}
              className="group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <div className={`bg-gradient-to-br ${getContestColor(contest.contest_type)} p-1 rounded-2xl shadow-lg`}>
                <div className="bg-white rounded-2xl p-8 h-full flex flex-col items-center text-center">
                  <div className="text-6xl mb-4 group-hover:animate-bounce">
                    {getContestEmoji(contest.contest_type)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-gray-900">
                    {contest.contest_name}
                  </h3>
                  <div className="text-sm text-gray-600 mb-2 font-medium">
                    {contest.event_name}
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    📅 {formatDate(contest.event_date, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  {contest.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {contest.description}
                    </p>
                  )}
                  <div className={`mt-auto w-full py-3 px-6 bg-gradient-to-r ${getContestColor(contest.contest_type)} text-white font-semibold rounded-xl transition-all group-hover:shadow-lg`}>
                    Enter Contest
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ContestSelectionPage;
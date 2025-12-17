import React from 'react';
import { EntryResult } from '@/types';
import { Button } from '@/components/common';

interface ResultCardProps {
  entry: EntryResult;
  rank: number;
  onDelete: (id: number, name: string) => void;
  showAdminControls?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({
  entry,
  rank,
  onDelete,
  showAdminControls = false,
}) => {
  const RatingDistribution: React.FC<{
    title: string;
    average: number;
    distribution: { [key: number]: number };
    color: string;
  }> = ({ title, average, distribution, color }) => {
    const getBarColor = (color: string) => {
      switch (color) {
        case 'text-blue-600': return 'bg-blue-400';
        case 'text-green-600': return 'bg-green-400';
        case 'text-orange-600': return 'bg-orange-400';
        default: return 'bg-gray-400';
      }
    };

    return (
      <div className="bg-gray-50 p-3 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>
        <div className={`text-lg font-bold ${color} mb-2`}>
          {average.toFixed(1)}
        </div>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map(star => {
            const count = distribution[star] || 0;
            const percentage = entry.vote_count > 0 ? (count / entry.vote_count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-6">{star}★</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`${getBarColor(color)} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const RankingDistribution: React.FC<{
    distribution: { [key: number]: number };
    voteCount: number;
  }> = ({ distribution, voteCount }) => {
    const rankEmojis: { [key: number]: string } = {
      1: '🥇',
      2: '🥈',
      3: '🥉',
      4: '4️⃣',
      5: '5️⃣',
    };

    const rankLabels: { [key: number]: string } = {
      1: '1st Place',
      2: '2nd Place',
      3: '3rd Place',
      4: '4th Place',
      5: '5th Place',
    };

    const getRankBarColor = (rank: number) => {
      switch (rank) {
        case 1: return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
        case 2: return 'bg-gradient-to-r from-gray-300 to-gray-500';
        case 3: return 'bg-gradient-to-r from-orange-400 to-orange-600';
        case 4: return 'bg-gradient-to-r from-blue-300 to-blue-500';
        case 5: return 'bg-gradient-to-r from-purple-300 to-purple-500';
        default: return 'bg-gray-400';
      }
    };

    return (
      <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 rounded-lg border-2 border-purple-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏆</span>
          <h4 className="text-lg font-semibold text-gray-800">Ranking Distribution</h4>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(rank => {
            const count = distribution[rank] || 0;
            const percentage = voteCount > 0 ? (count / voteCount) * 100 : 0;
            return (
              <div key={rank} className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 w-24">
                  <span className="text-xl">{rankEmojis[rank]}</span>
                  <span className="font-medium text-gray-700 text-xs">{rankLabels[rank]}</span>
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${getRankBarColor(rank)} h-3 rounded-full transition-all duration-300 shadow-sm`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 w-16 justify-end">
                  <span className="font-semibold text-gray-700 min-w-[2rem] text-right">{count}</span>
                  {voteCount > 0 && (
                    <span className="text-xs text-gray-500 w-10 text-right">
                      ({percentage.toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-purple-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              💡 Scoring: 1st = 5pts, 2nd = 4pts, 3rd = 3pts, 4th = 2pts, 5th = 1pt
            </span>
            <span className="text-sm font-semibold text-gray-700">
              Total: {voteCount} rankings
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="md:flex">
        <div className="md:w-1/3 relative">
          <img
            src={entry.photo}
            alt={entry.entry_name}
            className="w-full h-64 md:h-full object-cover"
          />
          {entry.vote_count < 5 && (
            <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
              ⚠ Low Votes ({entry.vote_count})
            </div>
          )}
        </div>

        <div className="md:w-2/3 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                #{rank} {entry.entry_name}
              </h3>
              <p className="text-gray-600">by {entry.contestant_name}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-600">
                  {entry.average_rating.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">
                  {entry.vote_count} votes
                </div>
              </div>
              {showAdminControls && (
                <Button
                  onClick={() => onDelete(entry.id, entry.entry_name)}
                  variant="danger"
                  size="sm"
                  title="Delete this entry permanently"
                >
                  🗑️ Delete
                </Button>
              )}
            </div>
          </div>

          {entry.contest_type !== 'sweater' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <RatingDistribution
                title="Appearance"
                average={entry.avg_appearance}
                distribution={entry.appearance_distribution}
                color="text-blue-600"
              />
              <RatingDistribution
                title="Texture"
                average={entry.avg_texture}
                distribution={entry.texture_distribution}
                color="text-green-600"
              />
              <RatingDistribution
                title="Flavor"
                average={entry.avg_flavor}
                distribution={entry.flavor_distribution}
                color="text-orange-600"
              />
            </div>
          )}

          {entry.contest_type === 'sweater' && entry.ranking_distribution && (
            <RankingDistribution
              distribution={entry.ranking_distribution}
              voteCount={entry.vote_count}
            />
          )}

          {entry.comments && entry.comments.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 text-lg">💬 Comments:</h4>
              <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
                {entry.comments.map((comment, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                    <div className="font-semibold text-indigo-700 mb-1 text-base">
                      {comment.voter_name}
                    </div>
                    <div className="text-gray-800 text-base leading-relaxed">
                      {comment.comment}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
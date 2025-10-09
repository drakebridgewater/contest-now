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
  }> = ({ title, average, distribution, color }) => (
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
              <div className="flex-1 bg-gray-200 rounded-full h-1">
                <div
                  className={`${color.replace('text-', 'bg-').replace('-600', '-400')} h-1 rounded-full`}
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

          {entry.comments && entry.comments.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Comments:</h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {entry.comments.map((comment, idx) => (
                  <div key={idx} className="text-sm bg-gray-50 p-2 rounded">
                    <span className="font-medium">{comment.voter_name}:</span> {comment.comment}
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
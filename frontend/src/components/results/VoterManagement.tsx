import React from 'react';
import { VoterInfo } from '@/types';
import { Button } from '@/components/common';
import { formatDate } from '@/utils/helpers';

interface VoterManagementProps {
  voters: VoterInfo[];
  onDeleteVoter: (voterName: string, voteCount: number) => void;
}

const VoterManagement: React.FC<VoterManagementProps> = ({
  voters,
  onDeleteVoter,
}) => {
  if (voters.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">👥 Voter Management</h3>
        <p className="text-gray-600">No voters found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">👥 Voter Management</h3>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Total voters: {voters.length}
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {voters.map((voter) => (
            <div
              key={voter.voter_name}
              className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
            >
              <div>
                <div className="font-medium text-gray-800">
                  {voter.voter_name}
                </div>
                <div className="text-sm text-gray-600">
                  {voter.vote_count} votes • First vote: {formatDate(voter.first_vote)} •
                  Last vote: {formatDate(voter.last_vote)}
                </div>
              </div>
              <Button
                onClick={() => onDeleteVoter(voter.voter_name, voter.vote_count)}
                variant="danger"
                size="sm"
                title="Delete this voter and all their votes"
              >
                🗑️ Delete
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoterManagement;
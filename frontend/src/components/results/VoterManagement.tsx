import React, { useState } from 'react';
import { VoterInfo } from '@/types';
import { Button } from '@/components/common';
import { formatDate } from '@/utils/helpers';

interface VoterManagementProps {
  voters: VoterInfo[];
  onDeleteVoter: (voterName: string, voteCount: number) => void;
  onUpdateVoterName: (oldName: string, newName: string) => void;
}

const VoterManagement: React.FC<VoterManagementProps> = ({
  voters,
  onDeleteVoter,
  onUpdateVoterName,
}) => {
  const [editingVoter, setEditingVoter] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');

  const handleStartEdit = (voterName: string) => {
    setEditingVoter(voterName);
    setNewName(voterName);
  };

  const handleSaveEdit = async (oldName: string) => {
    if (newName.trim() && newName.trim() !== oldName) {
      onUpdateVoterName(oldName, newName.trim());
    }
    setEditingVoter(null);
    setNewName('');
  };

  const handleCancelEdit = () => {
    setEditingVoter(null);
    setNewName('');
  };
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
              <div className="flex-1">
                {editingVoter === voter.voter_name ? (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="px-2 py-1 border rounded text-sm font-medium"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(voter.voter_name);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <Button
                      onClick={() => handleSaveEdit(voter.voter_name)}
                      variant="primary"
                      size="sm"
                      title="Save name"
                    >
                      ✓
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      variant="secondary"
                      size="sm"
                      title="Cancel edit"
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="font-medium text-gray-800 mb-1 flex items-center gap-2">
                    {voter.voter_name}
                    <Button
                      onClick={() => handleStartEdit(voter.voter_name)}
                      variant="secondary"
                      size="sm"
                      title="Edit voter name"
                    >
                      ✏️
                    </Button>
                  </div>
                )}
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
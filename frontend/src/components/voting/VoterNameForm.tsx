import React, { useState } from 'react';
import { Button, Input, InstructionCard } from '@/components/common';
import { isValidVoterName } from '@/utils/helpers';

interface VoterNameFormProps {
  onSubmit: (voterName: string) => void;
  autoLogoutEnabled: boolean;
  onAutoLogoutToggle: (enabled: boolean) => void;
}

const VoterNameForm: React.FC<VoterNameFormProps> = ({
  onSubmit,
  autoLogoutEnabled,
  onAutoLogoutToggle,
}) => {
  const [voterName, setVoterName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = voterName.trim();
    if (isValidVoterName(trimmedName)) {
      onSubmit(trimmedName);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidVoterName(voterName.trim())) {
      handleSubmit(e);
    }
  };

  const isValid = isValidVoterName(voterName.trim());

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          🗳️ Holiday Contest Voting
        </h2>
        <p className="text-gray-600">
          Help choose the best entries by rating appearance, texture, and flavor!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Enter Your Name to Vote
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Your name (e.g., John Smith)"
                  className="flex-1"
                  required
                />
                <Button
                  type="submit"
                  disabled={!isValid}
                  className="px-6"
                >
                  🗳️ Start Voting
                </Button>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoLogoutEnabled}
                    onChange={(e) => onAutoLogoutToggle(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    🔄 Auto-logout after 30 seconds (recommended for shared devices)
                  </span>
                </label>
              </div>
            </form>
          </div>
        </div>

        <div>
          <InstructionCard
            title="How to Vote"
            icon="⭐"
            variant="info"
            instructions={[
              "Rate each entry on appearance (1-5 stars)",
              "Rate texture/consistency (1-5 stars)",
              "Rate flavor and taste (1-5 stars)",
              "All three ratings are required to submit",
              "Add optional comments to share feedback",
              "You can update your votes anytime"
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default VoterNameForm;
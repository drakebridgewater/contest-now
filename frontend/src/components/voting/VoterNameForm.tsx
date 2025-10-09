import React, { useState } from 'react';
import { Button, Input } from '@/components/common';
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
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 mb-8">
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
            placeholder="Your name"
            className="flex-1"
            required
          />
          <Button
            type="submit"
            disabled={!isValid}
            className="px-6"
          >
            🗳️ Start Holiday Voting
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
              🔄 Auto-logout after 30 seconds (for shared devices)
            </span>
          </label>
        </div>
      </form>
    </div>
  );
};

export default VoterNameForm;
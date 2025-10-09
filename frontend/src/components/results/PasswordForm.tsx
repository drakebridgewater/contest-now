import React, { useState } from 'react';
import { Button, Input } from '@/components/common';

interface PasswordFormProps {
  onSubmit: (password: string) => void;
}

const PasswordForm: React.FC<PasswordFormProps> = ({ onSubmit }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        Enter Password to View Results
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Password"
          required
        />

        <Button type="submit" className="w-full">
          🏆 View Holiday Results
        </Button>
      </form>
    </div>
  );
};

export default PasswordForm;
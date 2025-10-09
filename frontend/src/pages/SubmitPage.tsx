import React from 'react';
import { CreateEntryRequest } from '@/types';
import { EntryForm } from '@/components/forms';
import { entryService } from '@/services/api';

interface SubmitPageProps {
  onEntrySubmitted: () => void;
}

const SubmitPage: React.FC<SubmitPageProps> = ({ onEntrySubmitted }) => {
  const [loading, setLoading] = React.useState(false);

  const handleSubmitEntry = async (entryData: CreateEntryRequest): Promise<void> => {
    setLoading(true);
    try {
      await entryService.create(entryData);
      onEntrySubmitted();
      alert('Entry submitted successfully!');
    } catch (error) {
      console.error('Error submitting entry:', error);
      alert('Failed to submit entry. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntryForm
      onSubmit={handleSubmitEntry}
      loading={loading}
    />
  );
};

export default SubmitPage;
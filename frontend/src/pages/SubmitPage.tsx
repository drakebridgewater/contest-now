import React from 'react';
import { CreateEntryRequest } from '@/types';
import { EntryForm } from '@/components/forms';
import { AlertDialog, InstructionCard } from '@/components/common';
import { entryService } from '@/services/api';

interface SubmitPageProps {
  onEntrySubmitted: () => void;
}

const SubmitPage: React.FC<SubmitPageProps> = ({ onEntrySubmitted }) => {
  const [loading, setLoading] = React.useState(false);
  const [alert, setAlert] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  const handleSubmitEntry = async (entryData: CreateEntryRequest): Promise<void> => {
    setLoading(true);
    try {
      await entryService.create(entryData);
      onEntrySubmitted();
      setAlert({
        isOpen: true,
        title: 'Success!',
        message: 'Entry submitted successfully!',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error submitting entry:', error);
      setAlert({
        isOpen: true,
        title: 'Submission Error',
        message: 'Failed to submit entry. Please try again.',
        variant: 'error'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          🎁 Submit Your Holiday Entry
        </h2>
        <p className="text-gray-600">
          Share your delicious creation with the PDXmas community!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <EntryForm
            onSubmit={handleSubmitEntry}
            loading={loading}
          />
        </div>

        <div className="space-y-6">
          <InstructionCard
            title="Submission Tips"
            icon="📸"
            variant="info"
            instructions={[
              "Take a clear, well-lit photo of your creation",
              "Make sure your entry name is descriptive",
              "Include all allergen information to keep everyone safe",
              "Choose the correct contest category",
              "Double-check everything before submitting!"
            ]}
          />

          <InstructionCard
            title="Photo Guidelines"
            icon="🌟"
            variant="success"
            instructions={[
              "Use good lighting - natural light works best",
              "Show the full dish/drink in the frame",
              "Clean the area around your creation",
              "Take the photo from a flattering angle",
              "Make it look as delicious as possible!"
            ]}
          />
        </div>
      </div>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </div>
  );
};

export default SubmitPage;
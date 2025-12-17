import React, { useState } from 'react';
import { CreateEntryRequest, ContestWithEvent } from '@/types';
import { Button, Input } from '@/components/common';
import ImageUpload from './ImageUpload';
import AllergenSelector from './AllergenSelector';
import { validateBase64Image } from '@/utils/helpers';

interface ContestEntryFormProps {
  contestId: string;
  contest: ContestWithEvent;
  onSubmit: (entry: CreateEntryRequest) => Promise<void>;
  loading?: boolean;
}

const ContestEntryForm: React.FC<ContestEntryFormProps> = ({
  contestId,
  contest,
  onSubmit,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    entry_name: '',
    contestant_name: '',
    photo: null as string | null,
    selectedAllergens: [] as string[],
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.entry_name.trim()) {
      newErrors.entry_name = 'Entry name is required';
    }

    if (!formData.contestant_name.trim()) {
      newErrors.contestant_name = 'Contestant name is required';
    }

    if (!formData.photo) {
      newErrors.photo = 'Photo is required';
    } else if (!validateBase64Image(formData.photo)) {
      newErrors.photo = 'Invalid photo format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !formData.photo) return;

    const entryData: CreateEntryRequest = {
      entry_name: formData.entry_name.trim(),
      contestant_name: formData.contestant_name.trim(),
      contest_id: contestId,
      photo: formData.photo,
      allergens: formData.selectedAllergens.length > 0 ? formData.selectedAllergens : undefined,
    };

    try {
      await onSubmit(entryData);

      // Reset form on success
      setFormData({
        entry_name: '',
        contestant_name: '',
        photo: null,
        selectedAllergens: [],
      });
      setPhotoPreview(null);
      setErrors({});
    } catch (error) {
      console.error('Error submitting entry:', error);
    }
  };

  const getContestEmoji = (contestType: string) => {
    switch (contestType) {
      case 'dessert': return '🍰';
      case 'cocktail': return '🍹';
      case 'appetizer': return '🥗';
      case 'sweater': return '🧥';
      case 'other': return '🏆';
      default: return '🎯';
    }
  };

  const isConsumableContest = (contestType: string) => {
    return ['dessert', 'cocktail', 'appetizer'].includes(contestType);
  };

  const handlePhotoChange = (photo: string) => {
    setFormData(prev => ({ ...prev, photo }));
    setPhotoPreview(photo);
    if (errors.photo) {
      setErrors(prev => ({ ...prev, photo: '' }));
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
          <span className="text-3xl">{getContestEmoji(contest.contest_type)}</span>
          Submit to {contest.contest_name}
        </h2>
        <p className="text-gray-600">
          {contest.event_name}
        </p>
        {contest.description && (
          <p className="text-gray-500 text-sm mt-2">{contest.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Your Name"
          value={formData.contestant_name}
          onChange={(e) => handleInputChange('contestant_name', e.target.value)}
          placeholder="Your name"
          required
          disabled={loading}
          error={errors.contestant_name}
        />

        <Input
          label="Contest Entry Name"
          value={formData.entry_name}
          onChange={(e) => handleInputChange('entry_name', e.target.value)}
          placeholder={`e.g., ${contest.contest_type === 'dessert' ? 'Santa\'s Sunset Paradise' :
                            contest.contest_type === 'cocktail' ? 'Holiday Eggnog Martini' :
                            contest.contest_type === 'appetizer' ? 'Festive Cheese Board' :
                            contest.contest_type === 'sweater' ? 'Rudolph\'s Reindeer Pullover' :
                            'My Amazing Entry'}`}
          required
          disabled={loading}
          error={errors.entry_name}
        />

        {isConsumableContest(contest.contest_type) && (
          <AllergenSelector
            selectedAllergens={formData.selectedAllergens}
            onChange={(allergens) => setFormData(prev => ({ ...prev, selectedAllergens: allergens }))}
            disabled={loading}
          />
        )}

        <ImageUpload
          onChange={handlePhotoChange}
          preview={photoPreview}
          disabled={loading}
        />
        {errors.photo && (
          <p className="text-sm text-red-600 mt-1">{errors.photo}</p>
        )}

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          className="w-full py-3 shadow-lg"
        >
          {loading ? '🎄 Submitting...' : `🎁 Submit to ${contest.contest_name}`}
        </Button>
      </form>
    </div>
  );
};

export default ContestEntryForm;
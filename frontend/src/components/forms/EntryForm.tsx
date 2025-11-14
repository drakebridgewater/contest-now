import React, { useState } from 'react';
import { CreateEntryRequest, ContestType } from '@/types';
import { Button, Input } from '@/components/common';
import ImageUpload from './ImageUpload';
import AllergenSelector from './AllergenSelector';
import { validateBase64Image } from '@/utils/helpers';

interface EntryFormProps {
  onSubmit: (entry: CreateEntryRequest) => Promise<void>;
  loading?: boolean;
}

const EntryForm: React.FC<EntryFormProps> = ({
  onSubmit,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    entry_name: '',
    contestant_name: '',
    contest_type: 'dessert' as ContestType,
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
      contest_type: formData.contest_type,
      photo: formData.photo,
      allergens: formData.selectedAllergens.length > 0 ? formData.selectedAllergens : undefined,
    };

    try {
      await onSubmit(entryData);

      // Reset form on success
      setFormData({
        entry_name: '',
        contestant_name: '',
        contest_type: 'dessert',
        photo: null,
        selectedAllergens: [],
      });
      setPhotoPreview(null);
      setErrors({});
    } catch (error) {
      console.error('Error submitting entry:', error);
    }
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
      {/*<h2 className="text-2xl font-bold text-gray-800 mb-6">*/}
      {/*  Submit PDXmas Contest Entry*/}
      {/*</h2>*/}

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
          placeholder="e.g., Santa's Sunset Paradise"
          required
          disabled={loading}
          error={errors.entry_name}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Contest Category *
          </label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="contestType"
                value="dessert"
                checked={formData.contest_type === 'dessert'}
                onChange={(e) => handleInputChange('contest_type', e.target.value)}
                disabled={loading}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                🍰 Dessert Contest
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                name="contestType"
                value="cocktail"
                checked={formData.contest_type === 'cocktail'}
                onChange={(e) => handleInputChange('contest_type', e.target.value)}
                disabled={loading}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                🍹 Cocktail Contest
              </span>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                name="contestType"
                value="appetizer"
                checked={formData.contest_type === 'appetizer'}
                onChange={(e) => handleInputChange('contest_type', e.target.value)}
                disabled={loading}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                🥗 Appetizer Contest
              </span>
            </label>
          </div>
        </div>

        <AllergenSelector
          selectedAllergens={formData.selectedAllergens}
          onChange={(allergens) => setFormData(prev => ({ ...prev, selectedAllergens: allergens }))}
          disabled={loading}
        />

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
          {loading ? '🎄 Submitting...' : '🎁 Submit Your Holiday Entry'}
        </Button>
      </form>
    </div>
  );
};

export default EntryForm;

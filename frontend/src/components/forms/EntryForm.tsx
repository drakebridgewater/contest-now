import React, { useState, useEffect } from 'react';
import { CreateEntryRequest, ContestWithEvent } from '@/types';
import { Button, Input } from '@/components/common';
import ImageUpload from './ImageUpload';
import AllergenSelector from './AllergenSelector';
import { validateBase64Image, formatDate } from '@/utils/helpers';
import { contestService } from '@/services/api';

interface EntryFormProps {
  onSubmit: (entry: CreateEntryRequest) => Promise<void>;
  loading?: boolean;
}

const EntryForm: React.FC<EntryFormProps> = ({
  onSubmit,
  loading = false,
}) => {
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);
  const [formData, setFormData] = useState({
    entry_name: '',
    contestant_name: '',
    contest_id: '',
    photo: null as string | null,
    selectedAllergens: [] as string[],
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadContests = async () => {
      try {
        const activeContests = await contestService.getActive();
        setContests(activeContests);
        // Auto-select first contest if available
        if (activeContests.length > 0 && formData.contest_id === '') {
          setFormData(prev => ({ ...prev, contest_id: activeContests[0].id }));
        }
      } catch (error) {
        console.error('Error loading contests:', error);
      } finally {
        setLoadingContests(false);
      }
    };
    loadContests();
  }, []);

  const validateForm = (): boolean  => {
    const newErrors: Record<string, string> = {};

    if (!formData.entry_name.trim()) {
      newErrors.entry_name = 'Entry name is required';
    } else if (formData.entry_name.length > 200) {
      newErrors.entry_name = 'Entry name must be 200 characters or less';
    }

    if (!formData.contestant_name.trim()) {
      newErrors.contestant_name = 'Contestant name is required';
    } else if (formData.contestant_name.length > 100) {
      newErrors.contestant_name = 'Your name must be 100 characters or less';
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
      contest_id: formData.contest_id,
      photo: formData.photo,
      allergens: formData.selectedAllergens.length > 0 ? formData.selectedAllergens : undefined,
    };

    try {
      await onSubmit(entryData);

      // Reset form on success - reset to first contest
      setFormData({
        entry_name: '',
        contestant_name: '',
        contest_id: contests.length > 0 ? contests[0].id : '',
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
      default: return '🎯';
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

  if (loadingContests) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="text-center text-gray-600">Loading contests...</div>
      </div>
    );
  }

  if (contests.length === 0) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Active Contests</h2>
          <p className="text-gray-600">There are no active contests at the moment. Please check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Submit Contest Entry
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Input
            label="Your Name"
            value={formData.contestant_name}
            onChange={(e) => handleInputChange('contestant_name', e.target.value)}
            placeholder="Your name"
            required
            disabled={loading}
            error={errors.contestant_name}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.contestant_name.length}/100 characters
          </p>
        </div>

        <div>
          <Input
            label="Contest Entry Name"
            value={formData.entry_name}
            onChange={(e) => handleInputChange('entry_name', e.target.value)}
            placeholder="e.g., Santa's Sunset Paradise"
            required
            disabled={loading}
            error={errors.entry_name}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.entry_name.length}/200 characters
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Contest *
          </label>
          <select
            value={formData.contest_id}
            onChange={(e) => handleInputChange('contest_id', e.target.value)}
            disabled={loading}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              errors.contest_id ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">-- Select a contest --</option>
            {contests.map((contest) => (
              <option key={contest.id} value={contest.id}>
                {getContestEmoji(contest.contest_type)} {contest.contest_name} - {contest.event_name} ({formatDate(contest.event_date)})
              </option>
            ))}
          </select>
          {errors.contest_id && (
            <p className="text-sm text-red-600 mt-1">{errors.contest_id}</p>
          )}
          {formData.contest_id && (
            <p className="text-sm text-gray-600 mt-2">
              {contests.find(c => c.id === formData.contest_id)?.description}
            </p>
          )}
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
          disabled={loading || loadingContests}
          loading={loading}
          className="w-full py-3 shadow-lg"
        >
          {loading ? '🎄 Submitting...' : '🎁 Submit Your Entry'}
        </Button>
      </form>
    </div>
  );
};

export default EntryForm;
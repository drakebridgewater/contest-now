import React from 'react';
import { ALLERGENS } from '@/utils/constants';

interface AllergenSelectorProps {
  selectedAllergens: string[];
  onChange: (allergens: string[]) => void;
  disabled?: boolean;
}

const AllergenSelector: React.FC<AllergenSelectorProps> = ({
  selectedAllergens,
  onChange,
  disabled = false,
}) => {
  const handleAllergenToggle = (allergenId: string) => {
    if (disabled) return;

    const newAllergens = selectedAllergens.includes(allergenId)
      ? selectedAllergens.filter(id => id !== allergenId)
      : [...selectedAllergens, allergenId];

    onChange(newAllergens);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Allergen Information (Optional)
      </label>
      <p className="text-xs text-gray-500 mb-3">
        Select any allergens present in your entry to help other contestants with dietary restrictions
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ALLERGENS.map((allergen) => (
          <label
            key={allergen.id}
            className={`flex items-center space-x-2 p-2 border rounded-lg cursor-pointer transition-colors ${
              disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedAllergens.includes(allergen.id)}
              onChange={() => handleAllergenToggle(allergen.id)}
              disabled={disabled}
              className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
            />
            <span className="text-lg">{allergen.emoji}</span>
            <span className="text-sm font-medium text-gray-700">
              {allergen.label}
            </span>
          </label>
        ))}
      </div>

      {selectedAllergens.length > 0 && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-medium">
            ⚠️ Selected allergens:{' '}
            {selectedAllergens
              .map(id => ALLERGENS.find(a => a.id === id)?.label)
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AllergenSelector;
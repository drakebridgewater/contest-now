import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ALLERGENS, DIETARY_RESTRICTIONS } from '@/utils/constants';

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'allergens' | 'dietary'>('allergens');

  const handleAllergenToggle = (allergenId: string) => {
    if (disabled) return;

    const newAllergens = selectedAllergens.includes(allergenId)
      ? selectedAllergens.filter(id => id !== allergenId)
      : [...selectedAllergens, allergenId];

    onChange(newAllergens);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getAllergenLabel = (id: string) => {
    // First check top-level allergens
    const topLevel = ALLERGENS.find(a => a.id === id);
    if (topLevel) return topLevel.label;

    // Then check children
    for (const allergen of ALLERGENS) {
      if (allergen.children) {
        const child = allergen.children.find(c => c.id === id);
        if (child) return child.label;
      }
    }
    return id;
  };

  const renderAllergenItem = (allergen: any, isChild = false) => {
    const isSelected = selectedAllergens.includes(allergen.id);
    const hasChildren = allergen.children && allergen.children.length > 0;
    const isExpanded = expandedCategories.has(allergen.id);

    return (
      <div key={allergen.id} className={isChild ? 'ml-4' : ''}>
        <div
          className={`flex items-center space-x-2 p-2 border rounded-lg transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-gray-50 cursor-pointer'
          }`}
        >
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleCategory(allergen.id)}
              className="p-1 hover:bg-gray-200 rounded"
              disabled={disabled}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          <label className="flex items-center space-x-2 flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleAllergenToggle(allergen.id)}
              disabled={disabled}
              className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
            />
            <span className="text-lg">{allergen.emoji}</span>
            <span className="text-sm font-medium text-gray-700">
              {allergen.label}
            </span>
          </label>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-1">
            {allergen.children.map((child: any) => renderAllergenItem(child, true))}
          </div>
        )}
      </div>
    );
  };

  const selectedAllergenLabels = selectedAllergens
    .map(id => getAllergenLabel(id))
    .filter(Boolean);

  const selectedDietaryLabels = selectedAllergens
    .map(id => DIETARY_RESTRICTIONS.find(d => d.id === id)?.label)
    .filter(Boolean);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Allergen & Dietary Information (Optional)
      </label>
      <p className="text-xs text-gray-500 mb-4">
        Help others with dietary restrictions by selecting allergens and dietary information for your entry
      </p>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('allergens')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'allergens'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ⚠️ Allergens
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dietary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dietary'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🌱 Dietary Labels
        </button>
      </div>

      {/* Content */}
      {activeTab === 'allergens' ? (
        <div className="space-y-3">
          {ALLERGENS.map(allergen => renderAllergenItem(allergen))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIETARY_RESTRICTIONS.map((restriction) => (
            <div
              key={restriction.id}
              className={`p-3 border rounded-lg transition-colors ${
                disabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAllergens.includes(restriction.id)}
                  onChange={() => handleAllergenToggle(restriction.id)}
                  disabled={disabled}
                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 mt-0.5"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{restriction.emoji}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {restriction.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {restriction.description}
                  </p>
                </div>
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Selected Summary */}
      {(selectedAllergenLabels.length > 0 || selectedDietaryLabels.length > 0) && (
        <div className="mt-4 space-y-2">
          {selectedAllergenLabels.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ Contains allergens: {selectedAllergenLabels.join(', ')}
              </p>
            </div>
          )}

          {selectedDietaryLabels.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                🌱 Dietary info: {selectedDietaryLabels.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AllergenSelector;
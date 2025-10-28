import React from 'react';
import { Modal, Button } from '@/components/common';
import { AllergenPopupData } from '@/types';
import { getAllergenById } from '@/utils/helpers';
import { DIETARY_RESTRICTIONS } from '@/utils/constants';

interface AllergenModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AllergenPopupData | null;
}

const AllergenModal: React.FC<AllergenModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!data) return null;

  // Separate allergens from dietary restrictions
  const allergens = data.allergens.filter(id => {
    const item = getAllergenById(id);
    return item && !DIETARY_RESTRICTIONS.find(d => d.id === id);
  });

  const dietaryInfo = data.allergens.filter(id => {
    return DIETARY_RESTRICTIONS.find(d => d.id === id);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🍽️ Dietary Information"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-gray-700 font-medium">
          <strong>{data.entryName}</strong>
        </p>

        {allergens.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
              ⚠️ Contains Allergens:
            </h4>
            <div className="space-y-2">
              {allergens.map((allergenId) => {
                const allergen = getAllergenById(allergenId);
                return allergen ? (
                  <div
                    key={allergenId}
                    className="flex items-center space-x-3 p-2 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <span className="text-xl">{allergen.emoji}</span>
                    <span className="font-medium text-red-800">{allergen.label}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {dietaryInfo.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
              🌱 Dietary Information:
            </h4>
            <div className="space-y-2">
              {dietaryInfo.map((dietaryId) => {
                const dietary = getAllergenById(dietaryId);
                return dietary ? (
                  <div
                    key={dietaryId}
                    className="flex items-center space-x-3 p-2 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <span className="text-xl">{dietary.emoji}</span>
                    <div>
                      <span className="font-medium text-green-800">{dietary.label}</span>
                      {'description' in dietary && (
                        <p className="text-xs text-green-600 mt-1">{dietary.description}</p>
                      )}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Please note:</strong> This information is provided by the contestant.
            If you have severe allergies, please verify ingredients before tasting.
          </p>
        </div>

        <Button
          onClick={onClose}
          variant="primary"
          className="w-full"
        >
          I Understand
        </Button>
      </div>
    </Modal>
  );
};

export default AllergenModal;
import React from 'react';
import { Modal, Button } from '@/components/common';
import { AllergenPopupData } from '@/types';
import { getAllergenById } from '@/utils/helpers';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠️ Allergen Warning"
      size="md"
    >
      <div className="space-y-4">
        <div>
          <p className="text-gray-700 mb-3">
            <strong>{data.entryName}</strong> contains the following allergens:
          </p>
          <div className="space-y-2">
            {data.allergens.map((allergenId) => {
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Please note:</strong> This information is provided by the contestant.
            If you have severe allergies, please verify ingredients before tasting.
          </p>
        </div>

        <Button
          onClick={onClose}
          variant="danger"
          className="w-full"
        >
          I Understand
        </Button>
      </div>
    </Modal>
  );
};

export default AllergenModal;
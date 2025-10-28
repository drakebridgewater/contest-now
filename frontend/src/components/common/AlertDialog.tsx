import React from 'react';
import Modal from './Modal';
import Button from './Button';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK',
  variant = 'info',
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success': return '✓';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className={`text-2xl ${getIconColor()}`}>
            {getIcon()}
          </span>
          <p className="text-gray-700 whitespace-pre-line flex-1">{message}</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>
            {buttonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AlertDialog;
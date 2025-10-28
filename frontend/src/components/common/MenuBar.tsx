import React from 'react';
import { Button } from './';

interface MenuBarProps {
  title: string;
  subtitle?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    icon?: string;
  }>;
  status?: {
    text: string;
    variant: 'info' | 'success' | 'warning' | 'error';
  };
}

const MenuBar: React.FC<MenuBarProps> = ({
  title,
  subtitle,
  actions = [],
  status,
}) => {
  const getStatusClasses = (variant: string) => {
    switch (variant) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-2">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {status && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusClasses(status.variant)}`}>
              {status.text}
            </span>
          )}

          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'ghost'}
              size="sm"
              onClick={action.onClick}
              className="text-sm"
            >
              {action.icon && <span className="mr-1">{action.icon}</span>}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuBar;
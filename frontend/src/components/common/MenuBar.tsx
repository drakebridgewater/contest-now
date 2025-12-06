import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  currentUser?: string;
  showNavigation?: boolean;
}

const MenuBar: React.FC<MenuBarProps> = ({
  title,
  subtitle,
  actions = [],
  status,
  currentUser,
  showNavigation = false,
}) => {
  const location = useLocation();
  const getStatusClasses = (variant: string) => {
    switch (variant) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const isManagePage = location.pathname === '/manage';
  const isHomePage = location.pathname === '/';

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      {/* Global Navigation */}
      {showNavigation && (
        <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-3">
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isHomePage ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🏠 Contest Selection
            </Link>
            <Link
              to="/manage"
              className={`text-sm font-medium transition-colors ${
                isManagePage ? 'text-indigo-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🎯 Manage
            </Link>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                👤 Logged in as: <span className="font-medium text-gray-800">{currentUser}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Header */}
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
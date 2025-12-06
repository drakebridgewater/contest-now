import React from 'react';
import Navigation from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: string;
  onLogout?: () => void;
  showUserMenu?: boolean;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  currentUser,
  onLogout,
  showUserMenu = false,
  className = "min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-100"
}) => {
  return (
    <div className={className}>
      <Navigation
        currentUser={currentUser}
        onLogout={onLogout}
        showUserMenu={showUserMenu}
      />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default Layout;
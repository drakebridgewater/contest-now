import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ContestSelectionPage from './pages/ContestSelectionPage';
import ContestPage from './pages/ContestPage';
import ManagePage from './pages/ManagePage';
import TabletVotePage from './pages/TabletVotePage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Contest selection page - shows all available contests */}
        <Route path="/" element={<ContestSelectionPage />} />

        {/* Contest-specific page with UUID parameter */}
        <Route path="/contest/:contestId" element={<ContestPage />} />

        {/* Manage page - combines results, voter management, and admin controls */}
        <Route path="/manage" element={<ManagePage />} />

        {/* Tablet voting page for a specific event - shows all contests for that event */}
        <Route path="/vote/event/:eventId" element={<TabletVotePage />} />

        {/* Catch-all route - redirect to home */}
        <Route path="*" element={<ContestSelectionPage />} />
      </Routes>
    </Router>
  );
};

export default App;
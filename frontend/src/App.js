import React, { useState, useEffect } from 'react';
import { Star, Upload, ImageIcon } from 'lucide-react';

// API Configuration - Use environment variable or fallback to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function ContestApp() {
  const [currentPage, setCurrentPage] = useState('submit');
  const [entries, setEntries] = useState([]);
  const [votes, setVotes] = useState({});
  const [voterName, setVoterName] = useState('');
  const [isVoterNameSubmitted, setIsVoterNameSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Results page state
  const [resultsPassword, setResultsPassword] = useState('');
  const [isResultsAuthorized, setIsResultsAuthorized] = useState(false);
  const [resultsData, setResultsData] = useState([]);
  const [votersData, setVotersData] = useState([]);
  const [activeTab, setActiveTab] = useState('appetizer');

  // Auto-logout state
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Form state
  const [entryName, setEntryName] = useState('');
  const [contestantName, setContestantName] = useState('');
  const [contestType, setContestType] = useState('dessert');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Load entries from API
  const loadEntries = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_URL}/entries`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
      alert('Failed to load entries. Make sure the server is running.');
    }
  };

  // Load votes for current voter
  const loadVotes = async (voter) => {
    if (!voter) return;

    try {
      const response = await fetch(`${API_URL}/votes/${encodeURIComponent(voter)}`);
      const data = await response.json();
      setVotes({ ...votes, [voter]: data });
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadEntries();
    // const savedVoterName = window.voterName || '';
    // if (savedVoterName) {
    //   setVoterName(savedVoterName);
    //   loadVotes(savedVoterName);
    // }
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result);
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();

    if (!entryName || !contestantName || !contestType || !photo) {
      alert('Please fill in all fields, select a contest type, and upload a photo');
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for uploads

      const response = await fetch(`${API_URL}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry_name: entryName,
          contestant_name: contestantName,
          contest_type: contestType,
          photo: photo
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to submit entry');
      }

      await response.json();

      // Reset form
      setEntryName('');
      setContestantName('');
      setContestType('dessert');
      setPhoto(null);
      setPhotoPreview(null);

      // Reload entries
      await loadEntries();

      alert('Entry submitted successfully!');
    } catch (error) {
      console.error('Error submitting entry:', error);
      if (error.name === 'AbortError') {
        alert('Request timed out. Please try again.');
      } else {
        alert('Failed to submit entry. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVoterNameSubmit = () => {
    const trimmedName = voterName.trim();
    if (trimmedName && trimmedName.length >= 2) {
      window.voterName = trimmedName;
      setIsVoterNameSubmitted(true);
      loadVotes(trimmedName);
      if (!votes[trimmedName]) {
        setVotes({ ...votes, [trimmedName]: {} });
      }
    }
  };

  const handleRatingChange = async (entryId, ratingType, rating) => {
    if (!voterName) {
      alert('Please enter your name first');
      return;
    }

    const currentVote = votes[voterName]?.[entryId] || {
      appearance_rating: 0,
      texture_rating: 0,
      flavor_rating: 0,
      comment: ''
    };

    // Update the specific rating type
    const updatedVote = { ...currentVote, [ratingType]: rating };

    // Only submit if all three ratings are provided
    if (updatedVote.appearance_rating > 0 && updatedVote.texture_rating > 0 && updatedVote.flavor_rating > 0) {
      try {
        const response = await fetch(`${API_URL}/votes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voter_name: voterName,
            entry_id: entryId,
            appearance_rating: updatedVote.appearance_rating,
            texture_rating: updatedVote.texture_rating,
            flavor_rating: updatedVote.flavor_rating,
            comment: updatedVote.comment
          })
        });

        if (!response.ok) {
          throw new Error('Failed to submit vote');
        }
      } catch (error) {
        console.error('Error submitting rating:', error);
        alert('Failed to submit rating. Please try again.');
        return;
      }
    }

    // Update local state
    const updatedVotes = { ...votes };
    if (!updatedVotes[voterName]) {
      updatedVotes[voterName] = {};
    }
    updatedVotes[voterName][entryId] = updatedVote;
    setVotes(updatedVotes);
  };

  const handleCommentChange = async (entryId, comment) => {
    if (!voterName) {
      alert('Please enter your name first');
      return;
    }

    const currentVote = votes[voterName]?.[entryId] || {
      appearance_rating: 0,
      texture_rating: 0,
      flavor_rating: 0,
      comment: ''
    };

    const updatedVote = { ...currentVote, comment };

    // Only submit if all three ratings are provided
    if (updatedVote.appearance_rating > 0 && updatedVote.texture_rating > 0 && updatedVote.flavor_rating > 0) {
      try {
        const response = await fetch(`${API_URL}/votes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voter_name: voterName,
            entry_id: entryId,
            appearance_rating: updatedVote.appearance_rating,
            texture_rating: updatedVote.texture_rating,
            flavor_rating: updatedVote.flavor_rating,
            comment: comment
          })
        });

        if (!response.ok) {
          throw new Error('Failed to submit comment');
        }
      } catch (error) {
        console.error('Error submitting comment:', error);
        return;
      }
    }

    // Update local state
    const updatedVotes = { ...votes };
    if (!updatedVotes[voterName]) {
      updatedVotes[voterName] = {};
    }
    updatedVotes[voterName][entryId] = updatedVote;
    setVotes(updatedVotes);
  };

  // Auto-logout functions
  const startInactivityTimer = () => {
    if (!autoLogoutEnabled || !isVoterNameSubmitted) return;

    // Clear existing timer
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      clearInterval(inactivityTimer);
    }

    let seconds = 30;
    setTimeRemaining(seconds);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      seconds--;
      setTimeRemaining(seconds);
      if (seconds <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Auto-logout timer
    const timeout = setTimeout(() => {
      handleAutoLogout();
      clearInterval(countdownInterval);
    }, 30000);

    setInactivityTimer({ timeout, interval: countdownInterval });
  };

  const resetInactivityTimer = () => {
    if (!autoLogoutEnabled) return;

    if (inactivityTimer) {
      clearTimeout(inactivityTimer.timeout);
      clearInterval(inactivityTimer.interval);
    }
    setTimeRemaining(0);
    startInactivityTimer();
  };

  const handleAutoLogout = () => {
    setVoterName('');
    setIsVoterNameSubmitted(false);
    window.voterName = '';
    setTimeRemaining(0);
    if (inactivityTimer) {
      clearTimeout(inactivityTimer.timeout);
      clearInterval(inactivityTimer.interval);
      setInactivityTimer(null);
    }
  };

  // Start timer when voter is submitted and auto-logout is enabled
  React.useEffect(() => {
    if (isVoterNameSubmitted && autoLogoutEnabled) {
      startInactivityTimer();
    }
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer.timeout);
        clearInterval(inactivityTimer.interval);
      }
    };
  }, [isVoterNameSubmitted, autoLogoutEnabled]);

  // Add event listeners for user interaction to reset timer
  React.useEffect(() => {
    if (!autoLogoutEnabled || !isVoterNameSubmitted) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const resetTimerOnActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimerOnActivity, true);
    });

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimerOnActivity, true);
      });
    };
  }, [autoLogoutEnabled, isVoterNameSubmitted]);

  // Results functions
  const handleResultsPasswordSubmit = () => {
    const correctPassword = 'pdxmas2025'; // Change this to your desired password
    if (resultsPassword === correctPassword) {
      setIsResultsAuthorized(true);
      loadResults();
      loadVoters();
    } else {
      alert('Incorrect password');
    }
  };

  const loadResults = async () => {
    try {
      const response = await fetch(`${API_URL}/results`);
      const data = await response.json();
      setResultsData(data);
    } catch (error) {
      console.error('Error loading results:', error);
      alert('Failed to load results. Make sure the server is running.');
    }
  };

  const loadVoters = async () => {
    try {
      const response = await fetch(`${API_URL}/voters`);
      const data = await response.json();
      setVotersData(data);
    } catch (error) {
      console.error('Error loading voters:', error);
      alert('Failed to load voters. Make sure the server is running.');
    }
  };

  const handleDeleteEntry = async (entryId, entryName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${entryName}"?\n\nThis will permanently delete:\n- The entry\n- All votes for this entry\n- The uploaded photo\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/entries/${entryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      const result = await response.json();
      alert('Entry deleted successfully!');

      // Reload results to update the display
      loadResults();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleDeleteVoter = async (voterName, voteCount) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete voter "${voterName}"?\n\nThis will permanently delete:\n- The voter\n- All ${voteCount} votes by this voter\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/voters/${encodeURIComponent(voterName)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete voter');
      }

      const result = await response.json();
      alert(`Voter "${voterName}" and all their votes deleted successfully!`);

      // Reload both voters and results to update the display
      loadVoters();
      loadResults();
    } catch (error) {
      console.error('Error deleting voter:', error);
      alert('Failed to delete voter. Please try again.');
    }
  };

  const StarRating = ({ entryId, ratingType, currentRating, title, description }) => {
    const [hoveredRating, setHoveredRating] = useState(0);

    return (
      <div className="mb-4">
        <div className="mb-2">
          <h4 className="text-sm font-medium text-gray-700">{title}</h4>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-6 h-6 cursor-pointer transition-colors ${
                star <= (hoveredRating || currentRating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => handleRatingChange(entryId, ratingType, star)}
            />
          ))}
          <span className="ml-2 text-sm text-gray-600">
            {currentRating > 0 ? currentRating : 'Not rated'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-green-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-white mb-4 flex items-center gap-3">
            <span className="text-4xl">🎄</span>
            PDXmas Contest Platform
            <span className="text-4xl">❄️</span>
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentPage('submit')}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                currentPage === 'submit'
                  ? 'bg-white text-red-700 shadow-lg'
                  : 'bg-red-600 bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              🎁 Submit Entry
            </button>
            <button
              onClick={() => setCurrentPage('vote')}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                currentPage === 'vote'
                  ? 'bg-white text-green-700 shadow-lg'
                  : 'bg-green-600 bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              🗳️ Vote
            </button>
            <button
              onClick={() => setCurrentPage('results')}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                currentPage === 'results'
                  ? 'bg-white text-red-700 shadow-lg'
                  : 'bg-red-600 bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              🏆 Results
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'submit' ? (
          // Submission Form
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Submit PDXmas Contest Entry</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Name
                </label>
                <input
                  type="text"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Sunset Paradise"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contestant Name
                </label>
                <input
                  type="text"
                  value={contestantName}
                  onChange={(e) => setContestantName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Contest Category
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      id="dessert"
                      type="radio"
                      name="contestType"
                      value="dessert"
                      checked={contestType === 'dessert'}
                      onChange={(e) => setContestType(e.target.value)}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="dessert" className="ml-2 text-sm font-medium text-gray-900">
                      🍰 Dessert Contest
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="cocktail"
                      type="radio"
                      name="contestType"
                      value="cocktail"
                      checked={contestType === 'cocktail'}
                      onChange={(e) => setContestType(e.target.value)}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="cocktail" className="ml-2 text-sm font-medium text-gray-900">
                      🍹 Cocktail Contest
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="appetizer"
                      type="radio"
                      name="contestType"
                      value="appetizer"
                      checked={contestType === 'appetizer'}
                      onChange={(e) => setContestType(e.target.value)}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500"
                    />
                    <label htmlFor="appetizer" className="ml-2 text-sm font-medium text-gray-900">
                      🥗 Appetizer Contest
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Photo
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
                  {photoPreview ? (
                    <div className="space-y-4">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-h-64 mx-auto rounded-lg shadow-md"
                      />
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700">
                        <Upload className="w-5 h-5" />
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">Click to upload photo</p>
                      <p className="text-sm text-gray-400">PNG, JPG up to 10MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <button
                onClick={handleSubmitEntry}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-green-600 hover:from-red-700 hover:to-green-700'
                } text-white shadow-lg`}
              >
                {loading ? '🎄 Submitting...' : '🎁 Submit Your Holiday Entry'}
              </button>
            </div>
          </div>
        ) : currentPage === 'vote' ? (
          // Voting Page
          <div>
            {/* Voter Name Input */}
            {!isVoterNameSubmitted && (
              <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Enter Your Name to Vote</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && voterName.trim().length >= 2) {
                        handleVoterNameSubmit();
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Your name"
                  />
                  <button
                    onClick={handleVoterNameSubmit}
                    disabled={voterName.trim().length < 2}
                    className={`px-6 py-2 rounded-lg font-semibold ${
                      voterName.trim().length < 2
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700'
                    } text-white shadow-lg`}
                  >
                    🗳️ Start Holiday Voting
                  </button>
                </div>

                {!isVoterNameSubmitted && (
                  <div className="mb-1 mt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoLogoutEnabled}
                        onChange={(e) => setAutoLogoutEnabled(e.target.checked)}
                        className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">
                      🔄 Auto-logout after 30 seconds (for shared devices)
                    </span>
                    </label>
                  </div>
                )}
              </div>
            )}


            {isVoterNameSubmitted && (
              <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="flex justify-between items-center">
                  <p className="text-lg">
                    Voting as: <span className="font-bold text-indigo-600">{voterName}</span>
                    <button
                      onClick={() => {
                        setVoterName('');
                        setIsVoterNameSubmitted(false);
                        window.voterName = '';
                        if (inactivityTimer) {
                          clearTimeout(inactivityTimer.timeout);
                          clearInterval(inactivityTimer.interval);
                          setInactivityTimer(null);
                        }
                      }}
                      className="ml-4 text-sm text-gray-600 hover:text-indigo-600 underline"
                    >
                      Change voter
                    </button>
                  </p>
                  {autoLogoutEnabled && timeRemaining > 0 && (
                    <div className="text-sm text-orange-600 font-medium">
                      🔄 Auto-logout in {timeRemaining}s
                    </div>
                  )}
                </div>
                {autoLogoutEnabled && (
                  <p className="text-xs text-gray-500 mt-2">
                    Auto-logout enabled - touch anywhere to reset timer
                  </p>
                )}
              </div>
            )}

            {/* Entries Grid */}
            {entries.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">No entries yet</p>
                <p className="text-gray-400">Submit the first entry to get started!</p>
              </div>
            ) : (
              <div className="space-y-8">
                {['dessert', 'cocktail', 'appetizer'].map(contestType => {
                  const contestEntries = entries.filter(entry => entry.contest_type === contestType);
                  if (contestEntries.length === 0) return null;

                  const contestEmojis = {
                    'dessert': '🍰',
                    'cocktail': '🍹',
                    'appetizer': '🥗'
                  };

                  const contestNames = {
                    'dessert': 'Dessert Contest',
                    'cocktail': 'Cocktail Contest',
                    'appetizer': 'Appetizer Contest'
                  };

                  return (
                    <div key={contestType}>
                      <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <span className="text-3xl">{contestEmojis[contestType]}</span>
                        {contestNames[contestType]}
                      </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {contestEntries.map((entry) => {
                            const userVote = votes[voterName]?.[entry.id] || {
                              appearance_rating: 0,
                              texture_rating: 0,
                              flavor_rating: 0,
                              comment: ''
                            };

                            return (
                              <div key={entry.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <img
                                  src={entry.photo}
                                  alt={entry.entry_name}
                                  className="w-full h-48 object-cover"
                                />
                                <div className="p-6">
                                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                                    {entry.entry_name}
                                  </h3>
                                  <p className="text-gray-600 mb-4">by {entry.contestant_name}</p>

                                  <div className="space-y-4">
                                    <StarRating
                                      entryId={entry.id}
                                      ratingType="appearance_rating"
                                      currentRating={userVote.appearance_rating}
                                      title="Appearance Rating"
                                      description="Visual presentation and execution"
                                    />

                                    <StarRating
                                      entryId={entry.id}
                                      ratingType="texture_rating"
                                      currentRating={userVote.texture_rating}
                                      title="Texture Rating"
                                      description="Mouthfeel and consistency"
                                    />

                                    <StarRating
                                      entryId={entry.id}
                                      ratingType="flavor_rating"
                                      currentRating={userVote.flavor_rating}
                                      title="Flavor Rating"
                                      description="Taste and flavor balance"
                                    />

                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Your Comment:
                                      </label>
                                      <textarea
                                        value={userVote.comment}
                                        onChange={(e) => handleCommentChange(entry.id, e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                        rows="3"
                                        placeholder="Share your thoughts..."
                                        disabled={!voterName}
                                      />
                                    </div>

                                    {userVote.appearance_rating > 0 && userVote.texture_rating > 0 && userVote.flavor_rating > 0 && (
                                      <div className="text-center p-2 bg-green-50 rounded-lg">
                                        <span className="text-sm text-green-700 font-medium">
                                          ✓ Vote submitted successfully!
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}
          </div>
        ) : (
          // Results Page
          <div>
            {!isResultsAuthorized ? (
              <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Enter Password to View Results</h3>
                <div className="space-y-4">
                  <input
                    type="password"
                    value={resultsPassword}
                    onChange={(e) => setResultsPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleResultsPasswordSubmit();
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Password"
                  />
                  <button
                    onClick={handleResultsPasswordSubmit}
                    className="w-full px-6 py-2 bg-gradient-to-r from-red-600 to-green-600 hover:from-red-700 hover:to-green-700 text-white rounded-lg font-semibold shadow-lg"
                  >
                    🏆 View Holiday Results
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">🎄 PDXmas Contest Results</h2>
                    <div className="flex gap-3">
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                        🛡️ Admin Mode
                      </span>
                      <button
                        onClick={() => {
                          setIsResultsAuthorized(false);
                          setResultsPassword('');
                        }}
                        className="text-sm text-gray-600 hover:text-red-600 underline"
                      >
                        🔒 Lock Results
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Admin controls are enabled. You can delete entries permanently.
                  </p>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-lg shadow-md mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                      {[
                        { id: 'appetizer', name: '🥗 Appetizers', emoji: '🥗' },
                        { id: 'cocktail', name: '🍹 Cocktails', emoji: '🍹' },
                        { id: 'dessert', name: '🍰 Desserts', emoji: '🍰' },
                        { id: 'voters', name: '👥 Voters', emoji: '👥' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                            activeTab === tab.id
                              ? 'border-red-500 text-red-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {tab.name}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'voters' ? (
                  /* Voter Management Tab */
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">👥 Voter Management</h3>
                    {votersData.length === 0 ? (
                      <p className="text-gray-600">No voters found</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 mb-3">
                          Total voters: {votersData.length}
                        </p>
                        <div className="max-h-96 overflow-y-auto">
                          <div className="space-y-2">
                            {votersData.map((voter) => (
                              <div key={voter.voter_name} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                                <div>
                                  <div className="font-medium text-gray-800">{voter.voter_name}</div>
                                  <div className="text-sm text-gray-600">
                                    {voter.vote_count} votes • First vote: {new Date(voter.first_vote).toLocaleDateString()} • Last vote: {new Date(voter.last_vote).toLocaleDateString()}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteVoter(voter.voter_name, voter.vote_count)}
                                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                                  title="Delete this voter and all their votes"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Contest Results Tabs */
                  <div>
                    {(() => {
                      const contestResults = resultsData.filter(entry => entry.contest_type === activeTab);

                      if (contestResults.length === 0) {
                        const contestNames = {
                          'dessert': 'Dessert Contest',
                          'cocktail': 'Cocktail Contest',
                          'appetizer': 'Appetizer Contest'
                        };
                        return (
                          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                            <p className="text-gray-600 text-lg">No {contestNames[activeTab]} entries yet</p>
                            <p className="text-gray-400">Entries will appear here once submitted!</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-6">
                          {contestResults.map((entry, index) => (
                            <div key={entry.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                              <div className="md:flex">
                                <div className="md:w-1/3 relative">
                                  <img
                                    src={entry.photo}
                                    alt={entry.entry_name}
                                    className="w-full h-64 md:h-full object-cover"
                                  />
                                  {entry.vote_count < 5 && (
                                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                                      ⚠ Low Votes ({entry.vote_count})
                                    </div>
                                  )}
                                </div>
                                <div className="md:w-2/3 p-6">
                                  <div className="flex items-center justify-between mb-4">
                                    <div>
                                      <h3 className="text-xl font-bold text-gray-800">
                                        #{index + 1} {entry.entry_name}
                                      </h3>
                                      <p className="text-gray-600">by {entry.contestant_name}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="text-2xl font-bold text-indigo-600">
                                          {entry.average_rating?.toFixed(1) || '0.0'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {entry.vote_count || 0} votes
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteEntry(entry.id, entry.entry_name)}
                                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                                        title="Delete this entry permanently"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Appearance</h4>
                                      <div className="text-lg font-bold text-blue-600">
                                        {entry.avg_appearance?.toFixed(1) || '0.0'}
                                      </div>
                                      <div className="space-y-1 mt-2">
                                        {[5, 4, 3, 2, 1].map(star => {
                                          const count = entry.appearance_distribution?.[star] || 0;
                                          const percentage = entry.vote_count > 0 ? (count / entry.vote_count) * 100 : 0;
                                          return (
                                            <div key={star} className="flex items-center gap-2 text-xs">
                                              <span className="w-6">{star}★</span>
                                              <div className="flex-1 bg-gray-200 rounded-full h-1">
                                                <div
                                                  className="bg-blue-400 h-1 rounded-full"
                                                  style={{ width: `${percentage}%` }}
                                                ></div>
                                              </div>
                                              <span className="w-6 text-right">{count}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Texture</h4>
                                      <div className="text-lg font-bold text-green-600">
                                        {entry.avg_texture?.toFixed(1) || '0.0'}
                                      </div>
                                      <div className="space-y-1 mt-2">
                                        {[5, 4, 3, 2, 1].map(star => {
                                          const count = entry.texture_distribution?.[star] || 0;
                                          const percentage = entry.vote_count > 0 ? (count / entry.vote_count) * 100 : 0;
                                          return (
                                            <div key={star} className="flex items-center gap-2 text-xs">
                                              <span className="w-6">{star}★</span>
                                              <div className="flex-1 bg-gray-200 rounded-full h-1">
                                                <div
                                                  className="bg-green-400 h-1 rounded-full"
                                                  style={{ width: `${percentage}%` }}
                                                ></div>
                                              </div>
                                              <span className="w-6 text-right">{count}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-lg">
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Flavor</h4>
                                      <div className="text-lg font-bold text-orange-600">
                                        {entry.avg_flavor?.toFixed(1) || '0.0'}
                                      </div>
                                      <div className="space-y-1 mt-2">
                                        {[5, 4, 3, 2, 1].map(star => {
                                          const count = entry.flavor_distribution?.[star] || 0;
                                          const percentage = entry.vote_count > 0 ? (count / entry.vote_count) * 100 : 0;
                                          return (
                                            <div key={star} className="flex items-center gap-2 text-xs">
                                              <span className="w-6">{star}★</span>
                                              <div className="flex-1 bg-gray-200 rounded-full h-1">
                                                <div
                                                  className="bg-orange-400 h-1 rounded-full"
                                                  style={{ width: `${percentage}%` }}
                                                ></div>
                                              </div>
                                              <span className="w-6 text-right">{count}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>

                                  {entry.comments && entry.comments.length > 0 && (
                                    <div>
                                      <h4 className="font-medium text-gray-700 mb-2">Comments:</h4>
                                      <div className="max-h-32 overflow-y-auto space-y-2">
                                        {entry.comments.map((comment, idx) => (
                                          <div key={idx} className="text-sm bg-gray-50 p-2 rounded">
                                            <span className="font-medium">{comment.voter_name}:</span> {comment.comment}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

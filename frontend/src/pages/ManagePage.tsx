import React, { useState, useEffect } from 'react';
import {
  EntryResult,
  VoterInfo,
  ContestWithEvent,
  Event,
  CreateEventRequest,
  CreateContestRequest,
  ContestType
} from '@/types';
import { PasswordForm, ResultCard, VoterManagement } from '@/components/results';
import { ConfirmDialog, AlertDialog, LoadingSpinner, Button, Input } from '@/components/common';
import { Layout } from '@/components/layout';
import { RESULTS_PASSWORD } from '@/utils/constants';
import { entryService, voterService, contestService, eventService } from '@/services/api';
import { formatDate } from '@/utils/helpers';

type TabType = 'results' | 'voters' | 'events' | 'contests';

// Component for rendering results content
interface ResultsContentProps {
  resultsData: EntryResult[];
  contests: ContestWithEvent[];
  getContestEmoji: (contestType: string) => string;
  handleDeleteEntry: (entryId: number, entryName: string) => void;
}

const ResultsContent: React.FC<ResultsContentProps> = ({
  resultsData,
  contests,
  getContestEmoji,
  handleDeleteEntry,
}) => {
  // Group by contest
  const resultsByContest: Record<string, EntryResult[]> = {};
  for (const entry of resultsData) {
    if (!resultsByContest[entry.contest_id]) {
      resultsByContest[entry.contest_id] = [];
    }
    resultsByContest[entry.contest_id].push(entry);
  }

  return (
    <div className="space-y-10">
      {Object.entries(resultsByContest).map(([contestIdStr, contestResults]) => {
        const contest = contests.find(c => c.id === contestIdStr);
        const contestEmoji = getContestEmoji(contest?.contest_type || '');

        return (
          <div key={contestIdStr} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                <span className="text-3xl">{contestEmoji}</span>
                <div>
                  <div>{contest?.contest_name || 'Unknown Contest'}</div>
                  <div className="text-sm font-normal text-gray-600 mt-1">
                    📅 {contest?.event_name} • {contestResults.length} entries
                  </div>
                </div>
              </h3>
            </div>
            <div className="space-y-4">
              {contestResults.map((entry, index) => (
                <ResultCard
                  key={entry.id}
                  entry={entry}
                  rank={index + 1}
                  onDelete={handleDeleteEntry}
                  showAdminControls={true}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const INITIAL_EVENT_FORM: CreateEventRequest = {
  event_name: '',
  event_date: '',
  description: '',
  is_active: true,
};

const INITIAL_CONTEST_FORM: CreateContestRequest = {
  event_id: 0,
  contest_name: '',
  contest_type: 'dessert',
  description: '',
  is_active: true,
};

const INITIAL_ALERT: AlertState = {
  isOpen: false,
  title: '',
  message: '',
};

const INITIAL_CONFIRMATION: ConfirmationState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
};

const ManagePage: React.FC = () => {
  // Authentication state
  const [isAuthorized, setIsAuthorized] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('results');
  const [loading, setLoading] = useState(false);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);

  // Data state
  const [resultsData, setResultsData] = useState<EntryResult[]>([]);
  const [votersData, setVotersData] = useState<VoterInfo[]>([]);
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Form state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingContest, setEditingContest] = useState<ContestWithEvent | null>(null);
  const [eventForm, setEventForm] = useState<CreateEventRequest>(INITIAL_EVENT_FORM);
  const [contestForm, setContestForm] = useState<CreateContestRequest>(INITIAL_CONTEST_FORM);

  // Dialog states
  const [alert, setAlert] = useState<AlertState>(INITIAL_ALERT);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(INITIAL_CONFIRMATION);

  // Utility functions
  const showAlert = (title: string, message: string, variant: AlertState['variant'] = 'info') => {
    setAlert({ isOpen: true, title, message, variant });
  };

  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmation({ isOpen: true, title, message, onConfirm });
  };

  const resetForms = () => {
    setEditingEvent(null);
    setEditingContest(null);
    setEventForm(INITIAL_EVENT_FORM);
    setContestForm(INITIAL_CONTEST_FORM);
  };

  const getContestEmoji = (contestType: string): string => {
    const emojiMap: Record<string, string> = {
      dessert: '🍰',
      cocktail: '🍹',
      appetizer: '🥗',
      other: '🎯',
    };
    return emojiMap[contestType] || '🎯';
  };

  const handlePasswordSubmit = (password: string) => {
    setAlert(INITIAL_ALERT);

    if (password === RESULTS_PASSWORD) {
      setIsAuthorized(true);
      void loadAllData();
    } else {
      setTimeout(() => {
        showAlert('Invalid Password', 'Incorrect password. Please try again.', 'error');
      }, 50);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadAllData();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized && (activeTab === 'results' || activeTab === 'voters')) {
      loadResultsData();
    }
  }, [selectedContestId, isAuthorized, activeTab]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [contestsData, eventsData] = await Promise.all([
        contestService.getActive(),
        eventService.getAll(),
      ]);
      setContests(contestsData);
      setEvents(eventsData);

      if (activeTab === 'results' || activeTab === 'voters') {
        await loadResultsData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({
        isOpen: true,
        title: 'Loading Error',
        message: 'Failed to load data. Make sure the server is running.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadResultsData = async () => {
    try {
      const [results, voters] = await Promise.all([
        entryService.getResults(selectedContestId || undefined),
        voterService.getAll(),
      ]);
      setResultsData(results);
      setVotersData(voters);
    } catch (error) {
      console.error('Error loading results data:', error);
    }
  };

  const loadContestsAndEvents = async () => {
    try {
      const [contestsData, eventsData] = await Promise.all([
        contestService.getAll(),
        eventService.getAll(),
      ]);
      setContests(contestsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading contests and events:', error);
    }
  };

  // Results handlers
  const handleDeleteEntry = (entryId: number, entryName: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Entry',
      message: `Are you sure you want to delete "${entryName}"?\n\nThis will permanently delete:\n- The entry\n- All votes for this entry\n- The uploaded photo\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        try {
          await entryService.delete(entryId);
          setAlert({
            isOpen: true,
            title: 'Success',
            message: 'Entry deleted successfully!',
            variant: 'success'
          });
          await loadResultsData();
        } catch (error) {
          console.error('Error deleting entry:', error);
          setAlert({
            isOpen: true,
            title: 'Delete Error',
            message: 'Failed to delete entry. Please try again.',
            variant: 'error'
          });
        }
      }
    });
  };

  const handleDeleteVoter = (voterName: string, voteCount: number) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Voter',
      message: `Are you sure you want to delete voter "${voterName}"?\n\nThis will permanently delete:\n- The voter\n- All ${voteCount} votes by this voter\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        try {
          await voterService.delete(voterName);
          setAlert({
            isOpen: true,
            title: 'Success',
            message: `Voter "${voterName}" and all their votes deleted successfully!`,
            variant: 'success'
          });
          await loadResultsData();
        } catch (error) {
          console.error('Error deleting voter:', error);
          setAlert({
            isOpen: true,
            title: 'Delete Error',
            message: 'Failed to delete voter. Please try again.',
            variant: 'error'
          });
        }
      }
    });
  };

  // Event handlers
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await eventService.create(eventForm);
      showAlert('Success', 'Event created successfully!', 'success');
      setEventForm(INITIAL_EVENT_FORM);
      await loadContestsAndEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      showAlert('Error', 'Failed to create event. Please try again.', 'error');
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      await eventService.update(editingEvent.id, eventForm);
      showAlert('Success', 'Event updated successfully!', 'success');
      resetForms();
      await loadContestsAndEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      showAlert('Error', 'Failed to update event. Please try again.', 'error');
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEventForm({
      event_name: event.event_name,
      event_date: event.event_date,
      description: event.description || '',
      is_active: event.is_active,
    });
  };

  const handleDeleteEvent = (event: Event) => {
    const contestCount = contests.filter(c => c.event_id === event.id).length;
    const warningMessage = contestCount > 0
      ? `This will also delete ${contestCount} contest(s) and all their entries!`
      : 'This action cannot be undone.';

    showConfirmation(
      'Delete Event',
      `Are you sure you want to delete "${event.event_name}"?\n\n${warningMessage}`,
      async () => {
        try {
          await eventService.delete(event.id);
          showAlert('Success', 'Event deleted successfully!', 'success');
          await loadContestsAndEvents();
        } catch (error) {
          console.error('Error deleting event:', error);
          showAlert('Error', 'Failed to delete event. Please try again.', 'error');
        }
      }
    );
  };

  // Contest handlers
  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contestForm.event_id === 0) {
      showAlert('Validation Error', 'Please select an event for the contest.', 'warning');
      return;
    }

    try {
      await contestService.create(contestForm);
      showAlert('Success', 'Contest created successfully!', 'success');
      setContestForm(INITIAL_CONTEST_FORM);
      await loadContestsAndEvents();
    } catch (error) {
      console.error('Error creating contest:', error);
      showAlert('Error', 'Failed to create contest. Please try again.', 'error');
    }
  };

  const handleUpdateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContest) return;

    try {
      await contestService.update(editingContest.id, contestForm);
      showAlert('Success', 'Contest updated successfully!', 'success');
      resetForms();
      await loadContestsAndEvents();
    } catch (error) {
      console.error('Error updating contest:', error);
      showAlert('Error', 'Failed to update contest. Please try again.', 'error');
    }
  };

  const handleEditContest = (contest: ContestWithEvent) => {
    setEditingContest(contest);
    setContestForm({
      event_id: contest.event_id,
      contest_name: contest.contest_name,
      contest_type: contest.contest_type,
      description: contest.description || '',
      is_active: contest.is_active,
    });
  };

  const handleDeleteContest = (contest: ContestWithEvent) => {
    showConfirmation(
      'Delete Contest',
      `Are you sure you want to delete "${contest.contest_name}"?\n\nThis will also delete all entries and votes for this contest!\n\nThis action cannot be undone.`,
      async () => {
        try {
          await contestService.delete(contest.id);
          showAlert('Success', 'Contest deleted successfully!', 'success');
          await loadContestsAndEvents();
        } catch (error) {
          console.error('Error deleting contest:', error);
          showAlert('Error', 'Failed to delete contest. Please try again.', 'error');
        }
      }
    );
  };

  const handleViewContestResults = (contest: ContestWithEvent) => {
    setSelectedContestId(contest.id);
    setActiveTab('results');
  };

  const handleToggleEventActive = async (event: Event) => {
    try {
      await eventService.update(event.id, { is_active: !event.is_active });
      showAlert('Success', `Event ${!event.is_active ? 'activated' : 'deactivated'} successfully!`, 'success');
      await loadContestsAndEvents();
    } catch (error) {
      console.error('Error toggling event active state:', error);
      showAlert('Error', 'Failed to toggle event status. Please try again.', 'error');
    }
  };

  const handleToggleContestActive = async (contest: ContestWithEvent) => {
    try {
      await contestService.update(contest.id, { is_active: !contest.is_active });
      showAlert('Success', `Contest ${!contest.is_active ? 'activated' : 'deactivated'} successfully!`, 'success');
      await loadContestsAndEvents();
    } catch (error) {
      console.error('Error toggling contest active state:', error);
      showAlert('Error', 'Failed to toggle contest status. Please try again.', 'error');
    }
  };

  const handleLock = () => {
    setIsAuthorized(false);
    setResultsData([]);
    setVotersData([]);
    setEvents([]);
    setContests([]);
  };

  if (!isAuthorized) {
    return <PasswordForm onSubmit={handlePasswordSubmit} />;
  }

  return (
    <Layout>
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🎯 Manage Contest</h1>
              <p className="text-gray-600 mt-1">Results, voter management, and admin controls</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="bg-red-100 text-red-800 px-3 py-1 text-sm font-medium rounded-full">
                🛡️ Admin Mode
              </span>
              <Button
                onClick={handleLock}
                variant="ghost"
                size="sm"
              >
                🔒 Lock
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Management Tabs">
              {[
                { id: 'results', label: 'Results', icon: '📊', color: 'red' },
                { id: 'voters', label: 'Voters', icon: '👥', color: 'red' },
                { id: 'events', label: 'Events', icon: '📅', color: 'indigo', count: events.length },
                { id: 'contests', label: 'Contests', icon: '🏆', color: 'indigo', count: contests.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 ${
                    activeTab === tab.id
                      ? `border-${tab.color}-500 text-${tab.color}-600`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-semibold">
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Contest Filter for Results/Voters tabs */}
        {(activeTab === 'results' || activeTab === 'voters') && contests.length > 1 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="contest-filter-select" className="text-lg font-semibold text-gray-800">
                📌 Contest Filter
              </label>
              {selectedContestId && (
                <button
                  onClick={() => setSelectedContestId(null)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Clear Filter
                </button>
              )}
            </div>
            <select
              id="contest-filter-select"
              value={selectedContestId || ''}
              onChange={(e) => setSelectedContestId(e.target.value || null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
            >
              <option value="">🎯 All Contests</option>
              {contests.map((contest) => (
                <option key={contest.id} value={contest.id}>
                  {getContestEmoji(contest.contest_type)} {contest.contest_name} • {contest.event_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tab Content */}
        {loading && (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <LoadingSpinner size="lg" className="mx-auto mb-4 text-indigo-600" />
            <p className="text-lg text-gray-700 font-medium">Loading management data...</p>
            <p className="text-sm text-gray-500 mt-1">Please wait while we fetch the latest information</p>
          </div>
        )}

        {!loading && activeTab === 'voters' && (
          <VoterManagement
            voters={votersData}
            onDeleteVoter={handleDeleteVoter}
          />
        )}

        {!loading && activeTab === 'results' && (
          <div>
            {resultsData.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-600 text-xl font-semibold mb-2">No results available</p>
                <p className="text-gray-500">Contest entries and votes will appear here once submitted!</p>
              </div>
            ) : (
              <ResultsContent
                resultsData={resultsData}
                contests={contests}
                getContestEmoji={getContestEmoji}
                handleDeleteEntry={handleDeleteEntry}
              />
            )}
          </div>
        )}

        {!loading && activeTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h3>
              <form onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent} className="space-y-4">
                <Input
                  label="Event Name"
                  value={eventForm.event_name}
                  onChange={(e) => setEventForm({ ...eventForm, event_name: e.target.value })}
                  placeholder="e.g., Holiday Party 2024"
                  required
                />

                <Input
                  label="Event Date"
                  type="date"
                  value={eventForm.event_date}
                  onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  required
                />

                <div>
                  <label htmlFor="event-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    id="event-description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    placeholder="Event details..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="event_active"
                    checked={eventForm.is_active}
                    onChange={(e) => setEventForm({ ...eventForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="event_active" className="ml-2 text-sm text-gray-700">
                    Active (visible to users)
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingEvent ? '💾 Update Event' : '➕ Create Event'}
                  </Button>
                  {editingEvent && (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Events List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-bold text-gray-800">All Events</h3>
            {events.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                <p className="text-gray-600">No events created yet</p>
                <p className="text-gray-400 text-sm mt-1">Create your first event to get started!</p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-bold text-gray-800">{event.event_name}</h4>
                        <button
                          onClick={() => handleToggleEventActive(event)}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 hover:scale-105 transform ${
                            event.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                          title={`Click to ${event.is_active ? 'deactivate' : 'activate'} this event`}
                        >
                          {event.is_active ? '✅ Active' : '⏸️ Inactive'}
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        📅 {formatDate(event.event_date, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {contests.filter(c => c.event_id === event.id).length} contest(s)
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event)}
                        className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {!loading && activeTab === 'contests' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contest Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingContest ? 'Edit Contest' : 'Create New Contest'}
              </h3>
              <form onSubmit={editingContest ? handleUpdateContest : handleCreateContest} className="space-y-4">
                <div>
                  <label htmlFor="contest-event-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Event *
                  </label>
                  <select
                    id="contest-event-select"
                    value={contestForm.event_id}
                    onChange={(e) => setContestForm({ ...contestForm, event_id: Number.parseInt(e.target.value, 10) })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={0}>-- Select Event --</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.event_name} ({formatDate(event.event_date)})
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Contest Name"
                  value={contestForm.contest_name}
                  onChange={(e) => setContestForm({ ...contestForm, contest_name: e.target.value })}
                  placeholder="e.g., Dessert Contest"
                  required
                />

                <div>
                  <label htmlFor="contest-type-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Contest Type *
                  </label>
                  <select
                    id="contest-type-select"
                    value={contestForm.contest_type}
                    onChange={(e) => setContestForm({ ...contestForm, contest_type: e.target.value as ContestType })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="dessert">🍰 Dessert</option>
                    <option value="cocktail">🍹 Cocktail</option>
                    <option value="appetizer">🥗 Appetizer</option>
                    <option value="other">🎯 Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contest-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    id="contest-description"
                    value={contestForm.description}
                    onChange={(e) => setContestForm({ ...contestForm, description: e.target.value })}
                    placeholder="Contest details..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="contest_active"
                    checked={contestForm.is_active}
                    onChange={(e) => setContestForm({ ...contestForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="contest_active" className="ml-2 text-sm text-gray-700">
                    Active (visible to users)
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingContest ? '💾 Update Contest' : '➕ Create Contest'}
                  </Button>
                  {editingContest && (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Contests List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-bold text-gray-800">All Contests</h3>
            {contests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                <p className="text-gray-600">No contests created yet</p>
                <p className="text-gray-400 text-sm mt-1">Create an event first, then add contests!</p>
              </div>
            ) : (
              contests.map((contest) => (
                <div
                  key={contest.id}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getContestEmoji(contest.contest_type)}</span>
                        <h4 className="text-lg font-bold text-gray-800">{contest.contest_name}</h4>
                        <button
                          onClick={() => handleToggleContestActive(contest)}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 hover:scale-105 transform ${
                            contest.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                          title={`Click to ${contest.is_active ? 'deactivate' : 'activate'} this contest`}
                        >
                          {contest.is_active ? '✅ Active' : '⏸️ Inactive'}
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        📅 {contest.event_name} - {formatDate(contest.event_date)}
                      </p>
                      {contest.description && (
                        <p className="text-sm text-gray-600 mt-2">{contest.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2 capitalize">
                        Type: {contest.contest_type}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleViewContestResults(contest)}
                        className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        🏆 Results
                      </button>
                      <button
                        onClick={() => handleEditContest(contest)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteContest(contest)}
                        className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

      {/* Dialogs */}
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />

      <ConfirmDialog
        isOpen={confirmation.isOpen}
        onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmText="Delete"
        variant="danger"
      />
      </div>
    </Layout>
  );
};

export default ManagePage;
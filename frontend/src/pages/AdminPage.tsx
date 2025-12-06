import React, { useState, useEffect } from 'react';
import { Event, CreateEventRequest, ContestWithEvent, CreateContestRequest, ContestType } from '@/types';
import { Button, Input, ConfirmDialog, AlertDialog, LoadingSpinner, MenuBar } from '@/components/common';
import { eventService, contestService } from '@/services/api';
import { RESULTS_PASSWORD } from '@/utils/constants';
import { formatDate } from '@/utils/helpers';
import { PasswordForm } from '@/components/results';

const AdminPage: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [contests, setContests] = useState<ContestWithEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'contests'>('events');

  // Event form state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventForm, setEventForm] = useState<CreateEventRequest>({
    event_name: '',
    event_date: '',
    description: '',
    is_active: true,
  });

  // Contest form state
  const [editingContest, setEditingContest] = useState<ContestWithEvent | null>(null);
  const [contestForm, setContestForm] = useState<CreateContestRequest>({
    event_id: 0,
    contest_name: '',
    contest_type: 'dessert',
    description: '',
    is_active: true,
  });

  const [alert, setAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '' });

  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized]);

  const handlePasswordSubmit = (password: string) => {
    if (password === RESULTS_PASSWORD) {
      setIsAuthorized(true);
    } else {
      setAlert({
        isOpen: true,
        title: 'Invalid Password',
        message: 'Incorrect password. Please try again.',
        variant: 'error'
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, contestsData] = await Promise.all([
        eventService.getAll(),
        contestService.getAll(),
      ]);
      setEvents(eventsData);
      setContests(contestsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({
        isOpen: true,
        title: 'Loading Error',
        message: 'Failed to load data. Please try again.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Event handlers
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await eventService.create(eventForm);
      setAlert({
        isOpen: true,
        title: 'Success',
        message: 'Event created successfully!',
        variant: 'success'
      });
      setEventForm({ event_name: '', event_date: '', description: '', is_active: true });
      await loadData();
    } catch (error) {
      console.error('Error creating event:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to create event. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      await eventService.update(editingEvent.id, eventForm);
      setAlert({
        isOpen: true,
        title: 'Success',
        message: 'Event updated successfully!',
        variant: 'success'
      });
      setEditingEvent(null);
      setEventForm({ event_name: '', event_date: '', description: '', is_active: true });
      await loadData();
    } catch (error) {
      console.error('Error updating event:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to update event. Please try again.',
        variant: 'error'
      });
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
    setConfirmation({
      isOpen: true,
      title: 'Delete Event',
      message: `Are you sure you want to delete "${event.event_name}"?\n\n${contestCount > 0 ? `This will also delete ${contestCount} contest(s) and all their entries!` : 'This action cannot be undone.'}`,
      onConfirm: async () => {
        try {
          await eventService.delete(event.id);
          setAlert({
            isOpen: true,
            title: 'Success',
            message: 'Event deleted successfully!',
            variant: 'success'
          });
          await loadData();
        } catch (error) {
          console.error('Error deleting event:', error);
          setAlert({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete event. Please try again.',
            variant: 'error'
          });
        }
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEditingContest(null);
    setEventForm({ event_name: '', event_date: '', description: '', is_active: true });
    setContestForm({ event_id: 0, contest_name: '', contest_type: 'dessert', description: '', is_active: true });
  };

  // Contest handlers
  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contestForm.event_id === 0) {
      setAlert({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select an event for the contest.',
        variant: 'warning'
      });
      return;
    }

    try {
      await contestService.create(contestForm);
      setAlert({
        isOpen: true,
        title: 'Success',
        message: 'Contest created successfully!',
        variant: 'success'
      });
      setContestForm({ event_id: 0, contest_name: '', contest_type: 'dessert', description: '', is_active: true });
      await loadData();
    } catch (error) {
      console.error('Error creating contest:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to create contest. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleUpdateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContest) return;

    try {
      await contestService.update(editingContest.id, contestForm);
      setAlert({
        isOpen: true,
        title: 'Success',
        message: 'Contest updated successfully!',
        variant: 'success'
      });
      setEditingContest(null);
      setContestForm({ event_id: 0, contest_name: '', contest_type: 'dessert', description: '', is_active: true });
      await loadData();
    } catch (error) {
      console.error('Error updating contest:', error);
      setAlert({
        isOpen: true,
        title: 'Error',
        message: 'Failed to update contest. Please try again.',
        variant: 'error'
      });
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
    setConfirmation({
      isOpen: true,
      title: 'Delete Contest',
      message: `Are you sure you want to delete "${contest.contest_name}"?\n\nThis will also delete all entries and votes for this contest!\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        try {
          await contestService.delete(contest.id);
          setAlert({
            isOpen: true,
            title: 'Success',
            message: 'Contest deleted successfully!',
            variant: 'success'
          });
          await loadData();
        } catch (error) {
          console.error('Error deleting contest:', error);
          setAlert({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete contest. Please try again.',
            variant: 'error'
          });
        }
      }
    });
  };

  const getContestTypeEmoji = (type: ContestType) => {
    switch (type) {
      case 'dessert': return '🍰';
      case 'cocktail': return '🍹';
      case 'appetizer': return '🥗';
      default: return '🎯';
    }
  };

  if (!isAuthorized) {
    return <PasswordForm onSubmit={handlePasswordSubmit} />;
  }

  return (
    <div>
      <MenuBar
        title="🎯 Admin - Event & Contest Management"
        subtitle="Create and manage events and contests"
        status={{
          text: "🛡️ Admin Mode",
          variant: "error"
        }}
        actions={[
          {
            label: "Lock Admin",
            onClick: () => setIsAuthorized(false),
            variant: "ghost",
            icon: "🔒"
          }
        ]}
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('events')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'events'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📅 Events ({events.length})
            </button>
            <button
              onClick={() => setActiveTab('contests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'contests'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏆 Contests ({contests.length})
            </button>
          </nav>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <LoadingSpinner size="lg" className="mx-auto mb-4 text-indigo-600" />
          <p className="text-lg text-gray-700">Loading...</p>
        </div>
      ) : activeTab === 'events' ? (
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
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
                    <Button type="button" variant="secondary" onClick={handleCancelEdit}>
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
                        {event.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                            Inactive
                          </span>
                        )}
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contest Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingContest ? 'Edit Contest' : 'Create New Contest'}
              </h3>
              <form onSubmit={editingContest ? handleUpdateContest : handleCreateContest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event *
                  </label>
                  <select
                    value={contestForm.event_id}
                    onChange={(e) => setContestForm({ ...contestForm, event_id: parseInt(e.target.value) })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contest Type *
                  </label>
                  <select
                    value={contestForm.contest_type}
                    onChange={(e) => setContestForm({ ...contestForm, contest_type: e.target.value as ContestType })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="dessert">🍰 Dessert</option>
                    <option value="cocktail">🍹 Cocktail</option>
                    <option value="appetizer">🥗 Appetizer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
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
                    <Button type="button" variant="secondary" onClick={handleCancelEdit}>
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
                        <span className="text-2xl">{getContestTypeEmoji(contest.contest_type)}</span>
                        <h4 className="text-lg font-bold text-gray-800">{contest.contest_name}</h4>
                        {contest.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                            Inactive
                          </span>
                        )}
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
        title={confirmation.title}
        message={confirmation.message}
        onConfirm={() => {
          confirmation.onConfirm();
          setConfirmation({ ...confirmation, isOpen: false });
        }}
      />
    </div>
  );
};

export default AdminPage;

import { useState } from 'react';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addYears,
  subYears,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings as SettingsIcon,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  FilterIcon,
  Bell,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ParsedEvent } from '@/lib/nostr-utils';
import { useEvents } from '@/hooks/useEvents';
import { useCalendars } from '@/hooks/useCalendars';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import Settings from './Settings';
import CalendarSwitcher from './CalendarSwitcher';
import EditEventModal from './EditEventModal';
import ViewEventModal from './ViewEventModal';
import MonthView from './views/MonthView';
import WeekView from './views/WeekView';
import DayView from './views/DayView';
import YearView from './views/YearView';
import NotificationsView from './views/NotificationsView';

export interface ViewProps {
  currentDate: Date;
  events: ParsedEvent[];
  isLoading?: boolean;
  onDateClick: (date: Date, endDate?: Date) => void;
  onEventClick: (event: ParsedEvent) => void;
  onViewSwitch: (view: 'year' | 'month' | 'week' | 'day', date?: Date) => void;
  onSelectionChange?: (selection: { start: Date; end: Date } | null) => void;
}

export default function Calendar() {
  const { selectedCalendarId, pubkey } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<
    'year' | 'month' | 'week' | 'day' | 'notifications'
  >('month');
  const { events, isLoading, publishEvents, deleteEvent, refetch } = useEvents(
    currentDate,
    view === 'notifications' ? 'month' : view // fallback view for events hook
  );
  const { calendars } = useCalendars();
  const { hasUnread } = useNotifications();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [currentSelection, setCurrentSelection] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const handleViewSwitch = (
    newView: 'year' | 'month' | 'week' | 'day',
    date?: Date
  ) => {
    setView(newView);
    if (date) {
      setCurrentDate(date);
    }
    setCurrentSelection(null);
  };
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(
    undefined
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCalendarSwitcher, setShowCalendarSwitcher] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ParsedEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<ParsedEvent | null>(null);

  const handleOpenCreateModal = (date: Date, endDate?: Date) => {
    setSelectedDate(date);
    setSelectedEndDate(endDate);
    setEditingEvent(null);
    setShowCreateModal(true);
  };

  const handleEventPublished = async (eventsToPublish: any[]) => {
    // Publish all events
    try {
      await publishEvents(eventsToPublish);
      setShowCreateModal(false);
    } catch (e) {
      console.error('Failed to publish', e);
      alert('Failed to publish event: ' + e);
    }
  };

  const handleEventDeleted = async (id: string | string[]) => {
    try {
      await deleteEvent(id);
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditEvent = (event: ParsedEvent) => {
    const isCreator = event.pubkey === pubkey;
    if (isCreator) {
      setEditingEvent(event);
      setSelectedDate(new Date(event.start * 1000));
      setSelectedEndDate(undefined);
      setShowCreateModal(true);
    } else {
      setViewingEvent(event);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (view === 'year') {
      setCurrentDate(
        direction === 'next'
          ? addYears(currentDate, 1)
          : subYears(currentDate, 1)
      );
    } else if (view === 'month') {
      setCurrentDate(
        direction === 'next'
          ? addMonths(currentDate, 1)
          : subMonths(currentDate, 1)
      );
    } else if (view === 'week') {
      setCurrentDate(
        direction === 'next'
          ? addWeeks(currentDate, 1)
          : subWeeks(currentDate, 1)
      );
    } else {
      setCurrentDate(
        direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1)
      );
    }
  };

  if (showSettingsModal) {
    return (
      <div className='flex h-full flex-col'>
        <div className='flex items-center gap-4 border-b p-4'>
          <button
            onClick={() => setShowSettingsModal(false)}
            className='rounded-full p-2 hover:bg-zinc-100'
          >
            <ChevronLeft />
          </button>
          <h2 className='font-bold'>Settings</h2>
        </div>
        <div className='flex-1 overflow-auto'>
          <Settings />
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full w-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50'>
      {/* Desktop Sidebar */}
      {!isSidebarCollapsed && (
        <div className='hidden w-64 flex-col border-r border-zinc-200 lg:flex dark:border-zinc-800'>
          <div className='flex items-center gap-3 p-6 pb-2'>
            <img
              src='/icon.png'
              alt='Logo'
              className='h-8 w-8 rounded-xl shadow-sm'
            />
            <h1 className='text-lg font-bold tracking-tight'>Blossom</h1>
          </div>
          <div className='flex-1 overflow-y-auto'>
            <CalendarSwitcher />
          </div>
        </div>
      )}

      <div className='flex flex-1 flex-col overflow-hidden'>
        {/* Header - Mobile First */}
        <div className='sticky top-0 z-40 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'>
          {/* Mobile Header */}
          <div className='flex items-center justify-between px-4 py-3 lg:hidden'>
            <div className='flex items-center gap-3'>
              <img
                src='/icon.png'
                alt='Logo'
                className='h-8 w-8 rounded-xl shadow-sm'
              />
              <h1 className='text-lg font-semibold text-zinc-800 dark:text-zinc-100'>
                {view === 'year'
                  ? format(currentDate, 'yyyy')
                  : format(currentDate, 'MMM yyyy')}
              </h1>
            </div>

            <div className='flex items-center gap-2'>
              <button
                onClick={async () => {
                  await refetch();
                }}
                className='touch-manipulation rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                title='Refresh events'
                disabled={isLoading}
              >
                <RefreshCw
                  className={cn('h-5 w-5', isLoading && 'animate-spin')}
                />
              </button>
              <button
                onClick={() => setView('notifications')}
                className='relative touch-manipulation rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              >
                <Bell
                  className={cn(
                    'h-5 w-5',
                    view === 'notifications' && 'fill-current text-indigo-600'
                  )}
                />
                {hasUnread && (
                  <span className='absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500' />
                )}
              </button>
              <button
                onClick={() => handleNavigate('prev')}
                className='touch-manipulation rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              >
                <ChevronLeft className='h-5 w-5' />
              </button>
              <button
                onClick={() => handleNavigate('next')}
                className='touch-manipulation rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              >
                <ChevronRight className='h-5 w-5' />
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className='touch-manipulation rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              >
                <Menu className='h-5 w-5' />
              </button>
            </div>
          </div>

          {/* Mobile Sub-header */}
          <div className='flex items-center justify-between px-2 pb-3 lg:hidden'>
            <button
              onClick={() => setShowCalendarSwitcher(true)}
              className='flex touch-manipulation items-center gap-1 text-sm font-medium text-indigo-600 outline-none dark:text-indigo-400'
            >
              <span className='max-w-[80px] truncate'>
                {selectedCalendarId
                  ? calendars.find((c) => c.identifier === selectedCalendarId)
                      ?.name
                  : 'All Events'}
              </span>
              <FilterIcon className='h-3 w-3' />
            </button>
            {/* Mobile View Switcher */}
            <div className='flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900'>
              {(['year', 'month', 'week', 'day'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium capitalize',
                    view === v
                      ? 'bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={() =>
                currentSelection
                  ? handleOpenCreateModal(
                      currentSelection.start,
                      currentSelection.end
                    )
                  : handleOpenCreateModal(new Date())
              }
              className='flex touch-manipulation items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm'
            >
              <Plus className='h-4 w-4' />
            </button>
          </div>

          {/* Desktop Header */}
          <div className='hidden items-center justify-between px-6 py-4 lg:flex'>
            <div className='flex items-center gap-4'>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className='rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className='h-5 w-5' />
                ) : (
                  <PanelLeftClose className='h-5 w-5' />
                )}
              </button>
              <div className='flex items-center gap-3'>
                <img
                  src='/icon.png'
                  alt='Logo'
                  className='h-10 w-10 rounded-xl shadow-sm'
                />
                <h1 className='text-2xl font-semibold text-zinc-800 dark:text-zinc-100'>
                  {view === 'year'
                    ? format(currentDate, 'yyyy')
                    : format(currentDate, 'MMM yyyy')}
                </h1>
              </div>

              <button
                onClick={async () => {
                  await refetch();
                }}
                className='rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                title='Refresh events'
                disabled={isLoading}
              >
                <RefreshCw
                  className={cn('h-4 w-4', isLoading && 'animate-spin')}
                />
              </button>

              <div className='flex items-center rounded-md border border-zinc-200 p-1 dark:border-zinc-700'>
                <button
                  onClick={() => handleNavigate('prev')}
                  className='rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className='rounded-md px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800'
                >
                  Today
                </button>
                <button
                  onClick={() => handleNavigate('next')}
                  className='rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>

              <div className='flex items-center rounded-md border border-zinc-200 p-1 dark:border-zinc-700'>
                <button
                  onClick={() => setView('year')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'year'
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  )}
                >
                  Year
                </button>
                <button
                  onClick={() => setView('month')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'month'
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  )}
                >
                  Month
                </button>
                <button
                  onClick={() => setView('week')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'week'
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  )}
                >
                  Week
                </button>
                <button
                  onClick={() => setView('day')}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    view === 'day'
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  )}
                >
                  Day
                </button>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <button
                onClick={() => setView('notifications')}
                className='relative rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                title='Notifications'
              >
                <Bell
                  className={cn(
                    'h-5 w-5',
                    view === 'notifications' && 'fill-current text-indigo-600'
                  )}
                />
                {hasUnread && (
                  <span className='absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500' />
                )}
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className='rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              >
                <SettingsIcon className='h-5 w-5' />
              </button>
              <button
                onClick={() =>
                  currentSelection
                    ? handleOpenCreateModal(
                        currentSelection.start,
                        currentSelection.end
                      )
                    : handleOpenCreateModal(new Date())
                }
                className='flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-indigo-700'
              >
                <Plus className='h-4 w-4' />
                <span>Create Event</span>
              </button>
            </div>
          </div>
        </div>

        {view === 'year' && (
          <YearView
            currentDate={currentDate}
            events={events}
            isLoading={isLoading}
            onDateClick={handleOpenCreateModal}
            onEventClick={handleEditEvent}
            onViewSwitch={handleViewSwitch}
            onSelectionChange={setCurrentSelection}
          />
        )}
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            isLoading={isLoading}
            onDateClick={handleOpenCreateModal}
            onEventClick={handleEditEvent}
            onViewSwitch={handleViewSwitch}
            onSelectionChange={setCurrentSelection}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            isLoading={isLoading}
            onDateClick={handleOpenCreateModal}
            onEventClick={handleEditEvent}
            onViewSwitch={handleViewSwitch}
            onSelectionChange={setCurrentSelection}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            events={events}
            isLoading={isLoading}
            onDateClick={handleOpenCreateModal}
            onEventClick={handleEditEvent}
            onViewSwitch={handleViewSwitch}
            onSelectionChange={setCurrentSelection}
          />
        )}

        {view === 'notifications' && <NotificationsView />}

        {/* Modal - Mobile First */}
        {showCalendarSwitcher && (
          <div
            className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center'
            onClick={() => setShowCalendarSwitcher(false)}
          >
            <div
              className='flex max-h-[85vh] w-full flex-col rounded-t-xl bg-white p-4 pb-8 shadow-xl sm:max-w-sm sm:rounded-xl sm:pb-4 dark:bg-zinc-900'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='mb-4 flex flex-shrink-0 items-center justify-between'>
                <h3 className='text-lg font-semibold'>Select Calendar</h3>
                <button
                  onClick={() => setShowCalendarSwitcher(false)}
                  className='rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
              <div className='flex-1 overflow-y-auto pr-1'>
                <CalendarSwitcher
                  onSelect={() => setShowCalendarSwitcher(false)}
                />
              </div>
            </div>
          </div>
        )}

        <EditEventModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          selectedDate={selectedDate}
          initialEndDate={selectedEndDate}
          initialEvent={editingEvent}
          calendars={calendars}
          defaultCalendarId={selectedCalendarId}
          onEventPublished={handleEventPublished}
          onEventDeleted={handleEventDeleted}
          events={events}
        />

        {viewingEvent && (
          <ViewEventModal
            isOpen={!!viewingEvent}
            onClose={() => setViewingEvent(null)}
            event={viewingEvent}
          />
        )}
      </div>
    </div>
  );
}

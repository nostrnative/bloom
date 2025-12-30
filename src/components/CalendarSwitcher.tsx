import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCalendars } from '@/hooks/useCalendars';
import { useAppStore } from '@/lib/store';
import ContactSelector from './ContactSelector';
import {
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  X,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarSwitcherProps {
  onSelect?: () => void;
}

export default function CalendarSwitcher({ onSelect }: CalendarSwitcherProps) {
  const { calendars, createCalendar, deleteCalendar } = useCalendars();
  const queryClient = useQueryClient();
  const {
    selectedCalendarId,
    setSelectedCalendarId,
    statusFilters,
    setStatusFilters,
    hideDeclinedEvents,
    selectedContactPubkeys,
    setSelectedContactPubkeys,
    interestedContactPubkeys,
  } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isStatusExpanded, setIsStatusExpanded] = useState(true);
  const [isContactsExpanded, setIsContactsExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCalName, setNewCalName] = useState('');
  const [newCalDesc, setNewCalDesc] = useState('');

  const handleCreate = async () => {
    if (!newCalName.trim()) return;
    try {
      await createCalendar({
        name: newCalName,
        description: newCalDesc,
        identifier: crypto.randomUUID(),
      });
      setShowCreateModal(false);
      setNewCalName('');
      setNewCalDesc('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (identifier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this calendar?')) return;
    try {
      await deleteCalendar(identifier);
      if (selectedCalendarId === identifier) {
        setSelectedCalendarId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelect = (id: string | null) => {
    setSelectedCalendarId(id);
    setSelectedContactPubkeys([]);
    queryClient.invalidateQueries({ queryKey: ['events'] });
    onSelect?.();
  };

  const toggleStatus = (
    key: 'accepted' | 'tentative' | 'declined' | 'self'
  ) => {
    setStatusFilters({
      ...statusFilters,
      [key]: !statusFilters[key],
    });
  };

  return (
    <div className='flex flex-col gap-2 p-2'>
      <div className='flex items-center justify-between px-2 py-1'>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className='flex items-center gap-1'
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform',
              isExpanded ? '' : '-rotate-90'
            )}
          />
          <span className='text-xs font-semibold text-zinc-500 uppercase'>
            Calendars
          </span>
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className='rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        >
          <Plus className='h-4 w-4' />
        </button>
      </div>

      {isExpanded && (
        <div className='flex flex-col gap-1'>
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              selectedCalendarId === null
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
            )}
          >
            <div className='flex items-center gap-3'>
              <CalendarIcon className='h-4 w-4' />
              <span>All Events</span>
            </div>
            {selectedCalendarId === null && <Check className='h-4 w-4' />}
          </button>

          {calendars.map((cal) => (
            <div
              key={cal.identifier}
              onClick={() => handleSelect(cal.identifier)}
              className={cn(
                'group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                selectedCalendarId === cal.identifier
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
              )}
            >
              <div className='flex items-center gap-3 truncate'>
                <div
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full border',
                    selectedCalendarId === cal.identifier
                      ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400'
                      : 'border-zinc-300 bg-transparent dark:border-zinc-600'
                  )}
                >
                  {selectedCalendarId === cal.identifier && (
                    <div className='h-1.5 w-1.5 rounded-full bg-white' />
                  )}
                </div>
                <span className='truncate'>{cal.name}</span>
              </div>
              <div className='flex items-center gap-2'>
                {selectedCalendarId === cal.identifier && (
                  <Check className='h-4 w-4 md:hidden' />
                )}
                <button
                  onClick={(e) => handleDelete(cal.identifier, e)}
                  className='text-red-500 transition-opacity'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contacts View Section */}
      <div className='mt-2 flex items-center justify-between px-2 py-1'>
        <button
          onClick={() => setIsContactsExpanded(!isContactsExpanded)}
          className='flex items-center gap-1'
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform',
              isContactsExpanded ? '' : '-rotate-90'
            )}
          />
          <span className='text-xs font-semibold text-zinc-500 uppercase'>
            View Contact
          </span>
        </button>
      </div>

      {isContactsExpanded && (
        <div className='flex flex-col gap-2 px-1 pb-2'>
          <ContactSelector
            selectedPubkeys={selectedContactPubkeys}
            onSelect={(pks) => {
              setSelectedContactPubkeys(pks);
              setSelectedCalendarId(null);
              queryClient.invalidateQueries({ queryKey: ['events'] });
            }}
            multiple={true}
            pubkeyFilter={interestedContactPubkeys}
          />
          {selectedContactPubkeys.length > 0 && (
            <button
              onClick={() => {
                setSelectedContactPubkeys([]);
                queryClient.invalidateQueries({ queryKey: ['events'] });
              }}
              className='flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
            >
              <X className='h-3 w-3' />
              Clear Contact Filter
            </button>
          )}
        </div>
      )}

      <div className='mt-2 flex items-center justify-between px-2 py-1'>
        <button
          onClick={() => setIsStatusExpanded(!isStatusExpanded)}
          className='flex items-center gap-1'
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform',
              isStatusExpanded ? '' : '-rotate-90'
            )}
          />
          <span className='text-xs font-semibold text-zinc-500 uppercase'>
            Status
          </span>
        </button>
      </div>

      {isStatusExpanded && (
        <div className='flex flex-col gap-1'>
          {[
            { key: 'self', label: 'Created by Me' },
            { key: 'accepted', label: 'Accepted' },
            { key: 'tentative', label: 'Tentative' },
            { key: 'declined', label: 'Declined' },
          ].map(({ key, label }) => {
            const filterKey = key as keyof typeof statusFilters;
            const isDisabled = key === 'declined' && hideDeclinedEvents;
            const isChecked = isDisabled ? false : statusFilters[filterKey];

            return (
              <button
                key={key}
                disabled={isDisabled}
                onClick={() => toggleStatus(filterKey)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isChecked
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                  isDisabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <div className='flex items-center gap-3'>
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      isChecked
                        ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400'
                        : 'border-zinc-300 bg-transparent dark:border-zinc-600'
                    )}
                  >
                    {isChecked && <Check className='h-3 w-3 text-white' />}
                  </div>
                  <span>{label}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'>
          <div className='w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>New Calendar</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X className='h-5 w-5' />
              </button>
            </div>
            <div className='space-y-4'>
              <div>
                <label className='mb-1 block text-sm font-medium'>Name</label>
                <input
                  type='text'
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  className='w-full rounded-lg border border-zinc-200 p-2 dark:border-zinc-700 dark:bg-zinc-800'
                  placeholder='Work, Personal, etc.'
                  autoFocus
                />
              </div>
              <div>
                <label className='mb-1 block text-sm font-medium'>
                  Description
                </label>
                <textarea
                  value={newCalDesc}
                  onChange={(e) => setNewCalDesc(e.target.value)}
                  className='w-full rounded-lg border border-zinc-200 p-2 dark:border-zinc-700 dark:bg-zinc-800'
                  placeholder='Short description...'
                  rows={2}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!newCalName.trim()}
                className='w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50'
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

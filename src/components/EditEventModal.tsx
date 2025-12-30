import { useState, useEffect } from 'react';
import {
  format,
  addMonths,
  addYears,
  addWeeks,
  addDays,
  isAfter,
  differenceInCalendarDays,
  isSameDay,
  getHours,
  getMinutes,
} from 'date-fns';
import {
  Trash2,
  Calendar as CalendarIcon,
  MapPin,
  Bell,
  Repeat,
  Send,
  Check,
  X,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsedEvent } from '@/lib/nostr-utils';
import { nostrApi, UserProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRSVPs } from '@/hooks/useRSVPs';
import { useAppStore } from '@/lib/store';
import SendReminderModal from './SendReminderModal';
import ContactSelector from './ContactSelector';
import InviteeList from './InviteeList';

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#71717a', // Zinc
];

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  initialEndDate?: Date | undefined;
  initialEvent: ParsedEvent | null;
  calendars: { identifier: string; name: string }[];
  defaultCalendarId: string | null;
  onEventPublished: (events: any[]) => Promise<void>;
  onEventDeleted: (id: string | string[]) => Promise<void>;
  events: ParsedEvent[];
}

export default function EditEventModal({
  isOpen,
  onClose,
  selectedDate,
  initialEndDate,
  initialEvent,
  calendars,
  defaultCalendarId,
  onEventPublished,
  onEventDeleted,
  events,
}: EditEventModalProps) {
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [color, setColor] = useState('#3b82f6');

  // Date/Time State
  const [eventType, setEventType] = useState<'time' | 'date'>('date');
  const [startDateStr, setStartDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');

  // Recurrance & Reminder
  const [reminderMinutes, setReminderMinutes] = useState('0');
  const [repeatFreq, setRepeatFreq] = useState('none');
  const [repeatUntil, setRepeatUntil] = useState('');

  // Private State
  const [isPrivate, setIsPrivate] = useState(false);

  // UI State
  const { pubkey, getAllRelays } = useAppStore();
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [inviteeProfiles, setInviteeProfiles] = useState<
    Record<string, UserProfile>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteFuture, setDeleteFuture] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [updateFuture, setUpdateFuture] = useState(false);
  const isEdit = !initialEvent;

  // RSVP Logic
  const eventCoordinate =
    initialEvent && (initialEvent.kind === 31922 || initialEvent.kind === 31923)
      ? `${initialEvent.kind}:${initialEvent.pubkey}:${initialEvent.identifier}`
      : initialEvent?.id;

  const { rsvps, publishRSVP, myRSVP, isPublishing } = useRSVPs(
    eventCoordinate,
    initialEvent?.pubkey
  );
  const isCreator = initialEvent?.pubkey === pubkey;

  // Fetch profiles for invitees
  useEffect(() => {
    if (isOpen && initialEvent?.invitees && initialEvent.invitees.length > 0) {
      const fetchInvitees = async () => {
        const relays = getAllRelays();
        const fetched = await nostrApi.fetchProfiles(
          initialEvent.invitees,
          relays
        );
        const map: Record<string, UserProfile> = {};
        fetched.forEach((p) => (map[p.pubkey] = p));
        setInviteeProfiles((prev) => ({ ...prev, ...map }));
      };
      fetchInvitees();
    }
  }, [isOpen, initialEvent, getAllRelays]);

  // Initialize form when modal opens or props change
  useEffect(() => {
    if (isOpen && selectedDate) {
      if (initialEvent) {
        // Edit Mode
        setTitle(initialEvent.title);
        setDescription(initialEvent.description);
        setLocation(initialEvent.location || '');
        setCalendarId(initialEvent.calendarIds[0] || '');
        setColor(initialEvent.color || '#3b82f6');
        setReminderMinutes(initialEvent.reminderMinutes?.toString() || '0');
        setSelectedInvitees(initialEvent.invitees);
        // Detect frequency and until date from series if missing on current occurrence
        const freq =
          initialEvent.freq ||
          events.find((e) => e.parent === initialEvent.parent && e.freq)
            ?.freq ||
          'none';
        setRepeatFreq(freq);

        const until =
          initialEvent.until ||
          events.find((e) => e.parent === initialEvent.parent && e.until)
            ?.until;
        setRepeatUntil(until ? format(until * 1000, 'yyyy-MM-dd') : '');

        setIsPrivate(initialEvent.isPrivate || false);

        const start = new Date(initialEvent.start * 1000);
        setStartDateStr(format(start, 'yyyy-MM-dd'));

        if (initialEvent.isAllDay) {
          setEventType('date');
          setStartTimeStr('');
          setEndTimeStr('');
          if (initialEvent.end) {
            setEndDateStr(
              format(new Date(initialEvent.end * 1000), 'yyyy-MM-dd')
            );
          } else {
            setEndDateStr(format(start, 'yyyy-MM-dd'));
          }
        } else {
          setEventType('time');
          setStartTimeStr(format(start, 'HH:mm'));
          if (initialEvent.end) {
            const end = new Date(initialEvent.end * 1000);
            setEndDateStr(format(end, 'yyyy-MM-dd'));
            setEndTimeStr(format(end, 'HH:mm'));
          } else {
            setEndDateStr(format(start, 'yyyy-MM-dd'));
            setEndTimeStr('');
          }
        }
      } else {
        // Create Mode
        resetForm();
        setStartDateStr(format(selectedDate, 'yyyy-MM-dd'));
        setCalendarId(defaultCalendarId || '');

        if (initialEndDate) {
          // If endDate is provided, logic to determine view range
          if (isSameDay(selectedDate, initialEndDate)) {
            // Same day -> probably time range
            setEventType('time');
            setStartTimeStr(format(selectedDate, 'HH:mm'));
            setEndTimeStr(format(initialEndDate, 'HH:mm'));
            setEndDateStr(format(selectedDate, 'yyyy-MM-dd'));
          } else {
            // Diff days
            setEndDateStr(format(initialEndDate, 'yyyy-MM-dd'));
            if (
              getHours(selectedDate) !== 0 ||
              getMinutes(selectedDate) !== 0
            ) {
              setEventType('time');
              setStartTimeStr(format(selectedDate, 'HH:mm'));
              setEndTimeStr(format(initialEndDate, 'HH:mm'));
            } else {
              setEventType('date');
              setStartTimeStr('');
              setEndTimeStr('');
            }
          }
        } else {
          // Default single click logic
          setEndDateStr(format(selectedDate, 'yyyy-MM-dd'));

          // Smart time defaults based on view context (approximated by checking hours)
          if (getHours(selectedDate) !== 0 || getMinutes(selectedDate) !== 0) {
            // It's a specific time slot click
            setEventType('time');
            setStartTimeStr(format(selectedDate, 'HH:mm'));
            // Default to 1 hour duration
            const endDate = new Date(selectedDate.getTime() + 60 * 60 * 1000);
            setEndDateStr(format(endDate, 'yyyy-MM-dd'));
            setEndTimeStr(format(endDate, 'HH:mm'));
          } else {
            // It's likely a day view click or month view click (midnight)
            // Default to all day
            setEventType('date');
            setStartTimeStr('');
            setEndTimeStr('');
          }
        }
      }
    }
  }, [isOpen, selectedDate, initialEndDate, initialEvent, defaultCalendarId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setColor('#3b82f6');
    setReminderMinutes('0');
    setRepeatFreq('none');
    setRepeatUntil('');
    setSelectedInvitees([]);
    setIsPrivate(false);
    setEventType('time');
    setStartTimeStr('');
    setEndTimeStr('');
  };

  // Validation logic for repeat frequency
  const getEventDateDiff = () => {
    if (!startDateStr || !endDateStr) return 0;
    const s = new Date(startDateStr);
    const e = new Date(endDateStr);
    if (e < s) return -1;
    return differenceInCalendarDays(e, s);
  };

  const dateDiff = getEventDateDiff();
  const isDailyAllowed = dateDiff >= 0 && dateDiff < 1;
  const isWeeklyAllowed = dateDiff >= 0 && dateDiff < 7;
  const isMonthlyAllowed = dateDiff >= 0 && dateDiff < 28;
  const isYearlyAllowed = dateDiff >= 0 && dateDiff < 365;

  useEffect(() => {
    if (repeatFreq === 'daily' && !isDailyAllowed) setRepeatFreq('none');
    if (repeatFreq === 'weekly' && !isWeeklyAllowed) setRepeatFreq('none');
    if (repeatFreq === 'monthly' && !isMonthlyAllowed) setRepeatFreq('none');
    if (repeatFreq === 'yearly' && !isYearlyAllowed) setRepeatFreq('none');
  }, [
    dateDiff,
    repeatFreq,
    isDailyAllowed,
    isWeeklyAllowed,
    isMonthlyAllowed,
    isYearlyAllowed,
  ]);

  const handleSubmit = async () => {
    if (!title || !startDateStr) return;

    if (initialEvent && initialEvent.parent) {
      setUpdateFuture(false);
      setShowUpdateConfirm(true);
      return;
    }

    await executeSubmit(false);
  };

  const executeSubmit = async (shouldUpdateSeries: boolean) => {
    if (!title || !startDateStr) return;
    setIsSubmitting(true);

    const isAllDay = eventType === 'date';
    let currentStart: Date;

    if (isAllDay) {
      currentStart = new Date(`${startDateStr}T00:00:00`);
    } else {
      currentStart = new Date(
        startTimeStr
          ? `${startDateStr}T${startTimeStr}`
          : `${startDateStr}T00:00:00`
      );
    }

    let currentEnd: Date | undefined;
    if (endDateStr) {
      if (isAllDay) {
        currentEnd = new Date(`${endDateStr}T00:00:00`);
      } else {
        if (endTimeStr) {
          currentEnd = new Date(`${endDateStr}T${endTimeStr}`);
        } else {
          if (!startTimeStr) {
            currentEnd = new Date(`${endDateStr}T00:00:00`);
          } else {
            currentEnd = new Date(`${endDateStr}T23:59:59`);
          }
        }
      }
    }

    let durationMs = 0;
    if (currentEnd) {
      durationMs = currentEnd.getTime() - currentStart.getTime();
    }

    // Repeat Logic
    let endDateLimit = currentStart;
    const effectiveRepeatFreq =
      initialEvent?.parent && !shouldUpdateSeries ? 'none' : repeatFreq;

    if (effectiveRepeatFreq !== 'none') {
      if (repeatUntil) {
        endDateLimit = new Date(`${repeatUntil}T23:59:59`);
      } else {
        endDateLimit = addMonths(currentStart, 12);
      }
    }

    const maxLimit = addMonths(new Date(), 12 * 5);
    if (isAfter(endDateLimit, maxLimit)) {
      endDateLimit = maxLimit;
    }

    const repeatChanged =
      initialEvent?.freq !== repeatFreq ||
      (initialEvent?.until
        ? format(initialEvent.until * 1000, 'yyyy-MM-dd')
        : '') !== repeatUntil;

    let iterations = 0;
    const MAX_ITERATIONS = 366 * 5;
    let parentId = initialEvent?.parent || crypto.randomUUID();

    // If repeat settings changed, we must start a new series/id
    if (repeatChanged) {
      parentId = crypto.randomUUID();
    }

    const eventsToPublish: any[] = [];
    const idsToDelete: string[] = [];

    if (initialEvent) {
      idsToDelete.push(initialEvent.id);

      if (shouldUpdateSeries) {
        const futureEvents = events.filter(
          (e) =>
            e.parent === initialEvent.parent && e.start > initialEvent.start
        );
        idsToDelete.push(...futureEvents.map((e) => e.id));
      }
    }

    while (iterations < MAX_ITERATIONS) {
      const eventData: any = {
        title,
        description,
        start: Math.floor(currentStart.getTime() / 1000),
        end: currentEnd ? Math.floor(currentEnd.getTime() / 1000) : undefined,
        location,
        is_all_day: isAllDay,
        color,
        identifier:
          initialEvent && iterations === 0
            ? initialEvent.identifier
            : crypto.randomUUID(),
        old_event_id: undefined,
        calendar_id: calendarId,
        p_tags: isPrivate ? [] : selectedInvitees,
        is_private: isPrivate,
      };

      if (effectiveRepeatFreq !== 'none') {
        eventData.parent = parentId;
        eventData.freq = effectiveRepeatFreq;
        if (repeatUntil) {
          eventData.until = Math.floor(new Date(repeatUntil).getTime() / 1000);
        }
      } else if (initialEvent?.parent) {
        eventData.parent = initialEvent.parent;
      }

      (eventData as any).reminder_minutes = parseInt(reminderMinutes);
      eventsToPublish.push(eventData);

      if (effectiveRepeatFreq === 'none') break;

      if (effectiveRepeatFreq === 'daily') {
        currentStart = addDays(currentStart, 1);
      } else if (effectiveRepeatFreq === 'weekly') {
        currentStart = addWeeks(currentStart, 1);
      } else if (effectiveRepeatFreq === 'monthly') {
        currentStart = addMonths(currentStart, 1);
      } else if (effectiveRepeatFreq === 'yearly') {
        currentStart = addYears(currentStart, 1);
      }

      if (currentEnd) {
        currentEnd = new Date(currentStart.getTime() + durationMs);
      }

      if (isAfter(currentStart, endDateLimit)) break;
      iterations++;
    }

    if (idsToDelete.length > 0) {
      await onEventDeleted(idsToDelete);
    }

    await onEventPublished(eventsToPublish);
    setIsSubmitting(false);
    onClose();
  };

  const handleDelete = () => {
    if (!initialEvent) return;
    setShowDeleteConfirm(true);
    setDeleteFuture(false);
  };

  const confirmDelete = async () => {
    if (!initialEvent) return;
    setIsSubmitting(true);
    let idsToDelete: string[] = [initialEvent.id];

    if (deleteFuture && initialEvent.parent) {
      const futureEvents = events.filter(
        (e) => e.parent === initialEvent.parent && e.start >= initialEvent.start
      );
      idsToDelete = futureEvents.map((e) => e.id);
    }

    try {
      await onEventDeleted(idsToDelete);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Failed to delete event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className='max-h-[90vh] w-full overflow-x-hidden overflow-y-auto sm:max-w-[500px]'
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {initialEvent ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-800'>
              <div className='flex items-center gap-3'>
                <Lock
                  className={cn(
                    'h-5 w-5',
                    isPrivate ? 'text-indigo-600' : 'text-zinc-400'
                  )}
                />
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>
                    {isPrivate ? 'Private Event' : 'Public Event'}
                  </span>
                  <span className='text-xs text-zinc-500'>
                    {initialEvent
                      ? 'Visibility cannot be changed'
                      : isPrivate
                        ? 'Encrypted'
                        : 'Visible to everyone'}
                  </span>
                </div>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
                disabled={!!initialEvent}
              />
            </div>
            {initialEvent && (
              <div className='mr-auto flex w-full items-center justify-between gap-2 sm:w-auto'>
                <Button
                  variant='destructive'
                  onClick={handleDelete}
                  title='Delete Event'
                  disabled={isSubmitting}
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setShowReminderModal(true)}
                  title='Send Reminder'
                  disabled={isSubmitting}
                >
                  <Bell className='mr-2 h-4 w-4' />
                  Send Reminder
                </Button>
              </div>
            )}
            <div className='grid gap-2'>
              <Label htmlFor='title'>Title</Label>
              <Input
                id='title'
                placeholder='Event name'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className='text-lg font-medium dark:bg-zinc-900 dark:text-zinc-100'
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='location' className='flex items-center gap-2'>
                <MapPin className='h-4 w-4 text-zinc-500' />
                Location
              </Label>
              <Input
                id='location'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder='Add location'
                className='dark:bg-zinc-900 dark:text-zinc-100'
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Add details'
                className='resize-none dark:bg-zinc-900 dark:text-zinc-100'
              />
            </div>

            {isEdit && (
              <div className='grid gap-2'>
                <Label htmlFor='type'>Type</Label>
                <div className='flex w-full rounded-md border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900'>
                  <button
                    type='button'
                    onClick={() => setEventType('date')}
                    className={cn(
                      'flex-1 rounded-sm py-1.5 text-sm font-medium transition-all',
                      eventType === 'date'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                    )}
                  >
                    All Day
                  </button>
                  <button
                    type='button'
                    onClick={() => setEventType('time')}
                    className={cn(
                      'flex-1 rounded-sm py-1.5 text-sm font-medium transition-all',
                      eventType === 'time'
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                    )}
                  >
                    Time
                  </button>
                </div>
              </div>
            )}

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label>Start</Label>
                <Input
                  type='date'
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className='dark:bg-zinc-900 dark:text-zinc-100'
                  disabled={!!initialEvent?.parent}
                />
                {eventType === 'time' && (
                  <Input
                    type='time'
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                    className='dark:bg-zinc-900 dark:text-zinc-100'
                  />
                )}
              </div>
              <div className='grid gap-2'>
                <Label>End</Label>
                <Input
                  type='date'
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className='dark:bg-zinc-900 dark:text-zinc-100'
                  disabled={!!initialEvent?.parent}
                />
                {eventType === 'time' && (
                  <Input
                    type='time'
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                    className='dark:bg-zinc-900 dark:text-zinc-100'
                  />
                )}
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label className='flex items-center gap-2'>
                  <CalendarIcon className='h-4 w-4 text-zinc-500' />
                  Calendar
                </Label>
                <Select
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  className='dark:bg-zinc-900 dark:text-zinc-100'
                >
                  <option value=''>Personal</option>
                  {calendars.map((cal) => (
                    <option key={cal.identifier} value={cal.identifier}>
                      {cal.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className='grid gap-2'>
                <Label className='flex items-center gap-2'>
                  <Bell className='h-4 w-4 text-zinc-500' />
                  Reminder
                </Label>
                <Select
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(e.target.value)}
                  className='dark:bg-zinc-900 dark:text-zinc-100'
                >
                  <option value='0'>None</option>
                  <option value='15'>15 min before</option>
                  <option value='60'>1 hour before</option>
                  <option value='1440'>1 day before</option>
                </Select>
              </div>
            </div>

            <div className='grid gap-2'>
              <Label className='flex items-center gap-2'>
                <Repeat className='h-4 w-4 text-zinc-500' />
                Repeat
              </Label>

              <div className='grid grid-cols-2 gap-4'>
                <Select
                  value={repeatFreq}
                  onChange={(e) => setRepeatFreq(e.target.value)}
                  className='dark:bg-zinc-900 dark:text-zinc-100'
                >
                  <option value='none'>Does not repeat</option>
                  <option value='daily' disabled={!isDailyAllowed}>
                    Daily
                  </option>
                  <option value='weekly' disabled={!isWeeklyAllowed}>
                    Weekly
                  </option>
                  <option value='monthly' disabled={!isMonthlyAllowed}>
                    Monthly
                  </option>
                  <option value='yearly' disabled={!isYearlyAllowed}>
                    Yearly
                  </option>
                </Select>
                {repeatFreq !== 'none' && (
                  <Input
                    type='date'
                    value={repeatUntil}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                    placeholder='Until date'
                    className='dark:bg-zinc-900 dark:text-zinc-100'
                  />
                )}
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>Color</Label>
              <div className='flex flex-wrap items-center gap-2'>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type='button'
                    onClick={() => setColor(c)}
                    disabled={!!initialEvent?.parent}
                    className={cn(
                      'h-6 w-6 rounded-full border border-zinc-200 transition-all dark:border-zinc-700',
                      color === c
                        ? 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-zinc-100 dark:ring-offset-zinc-950'
                        : !!initialEvent?.parent
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <div className='relative ml-2'>
                  <Label htmlFor='custom-color' className='sr-only'>
                    Custom Color
                  </Label>
                  <div
                    className={cn(
                      'h-6 w-6 overflow-hidden rounded-full border border-zinc-200 transition-all dark:border-zinc-700',
                      !PRESET_COLORS.includes(color)
                        ? 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-zinc-100 dark:ring-offset-zinc-950'
                        : '',
                      !!initialEvent?.parent && 'cursor-not-allowed opacity-50'
                    )}
                    style={{
                      background: PRESET_COLORS.includes(color)
                        ? 'conic-gradient(from 90deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)'
                        : color,
                    }}
                  >
                    <input
                      id='custom-color'
                      type='color'
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      disabled={!!initialEvent?.parent}
                      className='absolute -top-1 -left-1 h-8 w-8 cursor-pointer opacity-0 disabled:cursor-not-allowed'
                    />
                  </div>
                </div>
              </div>
            </div>

            {initialEvent && !isPrivate && (
              <div className='grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800'>
                <div className='flex items-center justify-between'>
                  <Label>Invitee Status</Label>
                  <div className='flex gap-2 text-xs'>
                    <span className='flex items-center gap-1 text-green-600 dark:text-green-400'>
                      <Check className='h-3 w-3' />{' '}
                      {rsvps.filter((r) => r.status === 'accepted').length}
                    </span>
                    <span className='flex items-center gap-1 text-red-600 dark:text-red-400'>
                      <X className='h-3 w-3' />{' '}
                      {rsvps.filter((r) => r.status === 'declined').length}
                    </span>
                    <span className='flex items-center gap-1 text-yellow-600 dark:text-yellow-400'>
                      <HelpCircle className='h-3 w-3' />{' '}
                      {rsvps.filter((r) => r.status === 'tentative').length}
                    </span>
                  </div>
                </div>

                {initialEvent.invitees.length > 0 && (
                  <InviteeList
                    invitees={initialEvent.invitees}
                    rsvps={rsvps}
                    inviteeProfiles={inviteeProfiles}
                    className='mt-2'
                  />
                )}

                {!isCreator && (
                  <div className='mt-2 flex flex-wrap justify-end gap-2'>
                    <Button
                      size='sm'
                      type='button'
                      variant={
                        myRSVP?.status === 'accepted' ? 'default' : 'outline'
                      }
                      disabled={isPublishing || isSubmitting}
                      className={
                        myRSVP?.status === 'accepted'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : ''
                      }
                      onClick={async () => await publishRSVP('accepted')}
                    >
                      {isPublishing && myRSVP?.status !== 'accepted'
                        ? 'Loading...'
                        : 'Accept'}
                    </Button>
                    <Button
                      size='sm'
                      type='button'
                      variant={
                        myRSVP?.status === 'declined' ? 'default' : 'outline'
                      }
                      disabled={isPublishing || isSubmitting}
                      className={
                        myRSVP?.status === 'declined'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : ''
                      }
                      onClick={async () => await publishRSVP('declined')}
                    >
                      {isPublishing && myRSVP?.status !== 'declined'
                        ? 'Loading...'
                        : 'Decline'}
                    </Button>
                    <Button
                      size='sm'
                      type='button'
                      variant={
                        myRSVP?.status === 'tentative' ? 'default' : 'outline'
                      }
                      disabled={isPublishing || isSubmitting}
                      className={
                        myRSVP?.status === 'tentative'
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : ''
                      }
                      onClick={async () => await publishRSVP('tentative')}
                    >
                      {isPublishing && myRSVP?.status !== 'tentative'
                        ? 'Loading...'
                        : 'Tentative'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!isPrivate && (
              <div className='grid gap-2'>
                <Label className='flex items-center justify-between'>
                  <span>Invite Guests</span>
                  {selectedInvitees.length > 0 && (
                    <span className='text-xs font-normal text-zinc-500'>
                      {selectedInvitees.length} selected
                    </span>
                  )}
                </Label>
                <ContactSelector
                  multiple
                  selectedPubkeys={selectedInvitees}
                  onSelect={setSelectedInvitees}
                />
              </div>
            )}
          </div>

          <DialogFooter className='gap-2 sm:gap-0'>
            <div className='flex w-full justify-between gap-2 sm:w-auto'>
              <Button variant='outline' onClick={onClose}>
                Cancel
              </Button>

              <Button
                onClick={handleSubmit}
                className='gap-2'
                disabled={!title || isSubmitting}
              >
                <Send className='h-4 w-4' />
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showReminderModal && initialEvent && (
        <SendReminderModal
          event={initialEvent}
          onClose={() => setShowReminderModal(false)}
        />
      )}

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !open && setShowDeleteConfirm(false)}
      >
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
          </DialogHeader>
          <div className='py-4'>
            <p className='text-sm text-zinc-500'>
              Are you sure you want to delete this event? This action cannot be
              undone.
            </p>

            {initialEvent?.parent && (
              <div className='mt-6 flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'>
                <div className='flex flex-col gap-1'>
                  <Label className='text-sm font-medium'>
                    Delete future occurrences
                  </Label>
                  <p className='text-xs text-zinc-500'>
                    Delete all following events in this series
                  </p>
                </div>
                <Switch
                  checked={deleteFuture}
                  onCheckedChange={setDeleteFuture}
                />
              </div>
            )}
          </div>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button
              variant='outline'
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={confirmDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUpdateConfirm}
        onOpenChange={(open) => !open && setShowUpdateConfirm(false)}
      >
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>Update Event</DialogTitle>
          </DialogHeader>
          <div className='py-4'>
            <p className='text-sm text-zinc-500'>
              Are you sure you want to save these changes?
            </p>

            <div className='mt-6 flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'>
              <div className='flex flex-col gap-1'>
                <Label className='text-sm font-medium'>
                  Update future occurrences
                </Label>
                <p className='text-xs text-zinc-500'>
                  Apply changes to all following events in this series
                </p>
              </div>
              <Switch
                checked={updateFuture}
                onCheckedChange={setUpdateFuture}
              />
            </div>
          </div>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button
              variant='outline'
              onClick={() => setShowUpdateConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowUpdateConfirm(false);
                executeSubmit(updateFuture);
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

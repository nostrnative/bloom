import { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfDay,
  isSameDay,
  isBefore,
  isAfter,
} from 'date-fns';
import {
  Bell,
  LucidePersonStanding,
  LucideUsers,
  Loader2,
  Lock,
  Repeat,
} from 'lucide-react';

import { ParsedEvent } from '@/lib/nostr-utils';
import { cn, getEventColor } from '@/lib/utils';
import { ViewProps } from '../Calendar';
import { useAppStore } from '@/lib/store';

// Event layout calculation for consistent multi-day positioning
function calculateEventLayout(events: ParsedEvent[], days: Date[]) {
  const eventLayout = new Map<string, { level: number; color: any }>();
  const dayEventLevels = new Map<string, Set<number>>();

  // Initialize day tracking
  days.forEach((day) => {
    dayEventLevels.set(day.toDateString(), new Set());
  });

  // Sort events by start date, then by duration (longer events first)
  const sortedEvents = [...events].sort((a, b) => {
    const aStart = new Date(a.start * 1000).getTime();
    const bStart = new Date(b.start * 1000).getTime();
    if (aStart !== bStart) return aStart - bStart;

    const aDuration = (a.end || a.start) - a.start;
    const bDuration = (b.end || b.start) - b.start;
    return bDuration - aDuration;
  });

  // Assign levels to events
  sortedEvents.forEach((event) => {
    const eventStart = startOfDay(new Date(event.start * 1000));
    const eventEnd = event.end
      ? startOfDay(new Date(event.end * 1000))
      : eventStart;
    const color = getEventColor(event.id);

    // Find the lowest available level across all days of this event
    let level = 0;
    let levelFound = false;

    while (!levelFound) {
      let levelAvailable = true;

      // Check if this level is available on all days of the event
      for (
        let d = new Date(eventStart);
        d <= eventEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dayKey = d.toDateString();
        const dayLevels = dayEventLevels.get(dayKey);
        if (dayLevels && dayLevels.has(level)) {
          levelAvailable = false;
          break;
        }
      }

      if (levelAvailable) {
        // Reserve this level for all days of the event
        for (
          let d = new Date(eventStart);
          d <= eventEnd;
          d.setDate(d.getDate() + 1)
        ) {
          const dayKey = d.toDateString();
          const dayLevels = dayEventLevels.get(dayKey);
          if (dayLevels) {
            dayLevels.add(level);
          }
        }
        levelFound = true;
      } else {
        level++;
      }
    }

    eventLayout.set(event.id, { level, color });
  });

  return eventLayout;
}

export default function MonthView({
  currentDate,
  events,
  isLoading,
  onDateClick,
  onEventClick,
  onViewSwitch,
  onSelectionChange,
}: ViewProps) {
  const { pubkey, selectedContactPubkeys } = useAppStore();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [selection, setSelection] = useState<{ start: Date; end: Date } | null>(
    null
  );
  const [resizeState, setResizeState] = useState<
    'start' | 'end' | 'creating' | null
  >(null);

  // Sync selection to parent
  useEffect(() => {
    if (onSelectionChange) {
      if (selection) {
        const start = isBefore(selection.start, selection.end)
          ? selection.start
          : selection.end;
        const end = isAfter(selection.start, selection.end)
          ? selection.start
          : selection.end;
        onSelectionChange({ start, end });
      } else {
        onSelectionChange(null);
      }
    }
  }, [selection, onSelectionChange]);

  const handleCellPointerDown = (e: React.PointerEvent, day: Date) => {
    if (e.button !== 0) return;
    // If we are clicking on an existing selection overlay, the overlay click handler will take precedence
    // because it is higher z-index.
    // However, if we are here, we are clicking a cell.
    e.preventDefault();
    e.stopPropagation();

    setSelection({ start: day, end: day });
    setResizeState('creating');
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeStart = (e: React.PointerEvent, type: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState(type);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!resizeState || !selection) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const dayElement = elements.find((el) => el.hasAttribute('data-date'));
    const dateStr = dayElement?.getAttribute('data-date');

    if (dateStr) {
      const newDate = new Date(dateStr);
      setSelection((prev) => {
        if (!prev) return null;
        let { start, end } = prev;

        if (resizeState === 'creating') {
          return { start, end: newDate };
        }

        if (resizeState === 'start') {
          // If moving start past end, flip is handled but better to keep anchor if possible
          // Current logic: simple update
          return { start: newDate, end };
        }

        // resizeState === 'end'
        return { start, end: newDate };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState(null);
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Normalize selection direction on finish
    setSelection((prev) => {
      if (!prev) return null;
      if (isAfter(prev.start, prev.end)) {
        return { start: prev.end, end: prev.start };
      }
      return prev;
    });
  };

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selection) {
      // Ensure normalized order before callback
      const start = isBefore(selection.start, selection.end)
        ? selection.start
        : selection.end;
      const end = isAfter(selection.start, selection.end)
        ? selection.start
        : selection.end;
      onDateClick(start, end);
      setSelection(null);
    }
  };

  // Helper to normalize selection for rendering (swapping if needed)
  // Actually selection state should always be start <= end if we manage it right.
  // But let's be safe relative to rendering.
  const renderSelection = selection
    ? {
        start: isBefore(selection.start, selection.end)
          ? selection.start
          : selection.end,
        end: isBefore(selection.start, selection.end)
          ? selection.end
          : selection.start,
      }
    : null;

  // Calculate event layout for consistent positioning
  const eventLayout = calculateEventLayout(events, days);

  return (
    <div
      className='flex flex-1 flex-col'
      onMouseLeave={() => {
        // Optional cleanup
      }}
    >
      {/* Grid Header */}
      <div className='grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/30 dark:border-zinc-800 dark:bg-zinc-900/30'>
        {weekDays.map((day) => (
          <div
            key={day}
            className='py-3 text-center text-xs font-semibold text-zinc-500 uppercase sm:py-2'
          >
            <span className='hidden sm:inline'>{day}</span>
            <span className='sm:hidden'>{day.slice(0, 1)}</span>
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div
        className='relative grid flex-1 grid-cols-7 overflow-y-auto'
        style={{
          gridTemplateRows: `repeat(${days.length / 7}, minmax(100px, 1fr))`,
        }}
      >
        {isLoading && (
          <div className='absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-white/80 dark:bg-zinc-950/80'>
            <Loader2 className='h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400' />
            <p className='text-sm text-zinc-500 dark:text-zinc-400'>
              Loading events...
            </p>
          </div>
        )}
        {days.map((day, idx) => {
          const normalizeSel = renderSelection;
          const isSelected =
            normalizeSel &&
            (isSameDay(day, normalizeSel.start) ||
              isSameDay(day, normalizeSel.end) ||
              (isAfter(day, normalizeSel.start) &&
                isBefore(day, normalizeSel.end)));

          const isStart = normalizeSel && isSameDay(day, normalizeSel.start);
          const isEnd = normalizeSel && isSameDay(day, normalizeSel.end);

          const dayEvents = events.filter((e) => {
            const eventStart = startOfDay(new Date(e.start * 1000));
            const eventEnd = e.end
              ? startOfDay(new Date(e.end * 1000))
              : eventStart;
            const currentDay = startOfDay(day);

            return currentDay >= eventStart && currentDay <= eventEnd;
          });
          return (
            <div
              key={day.toString()}
              data-date={day.toISOString()}
              onPointerDown={(e) => handleCellPointerDown(e, day)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={cn(
                'relative min-h-0 cursor-pointer touch-manipulation border-r border-b border-zinc-200 transition-colors dark:border-zinc-800',
                resizeState && 'touch-none',
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-900/20'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-900',
                !isSameMonth(day, monthStart) &&
                  !isSelected &&
                  'bg-zinc-50/30 text-zinc-400 dark:bg-zinc-900/30',
                idx % 7 === 0 && 'border-l'
              )}
            >
              <div className='mb-1 flex items-start justify-between p-1 sm:p-2'>
                <span
                  className={cn(
                    'flex h-6 w-6 min-w-0 touch-manipulation items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm',
                    isToday(day) && 'bg-indigo-600 text-white',
                    !isSameMonth(day, monthStart) &&
                      !isToday(day) &&
                      'text-zinc-400'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 2 && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewSwitch?.('day', day);
                    }}
                    className='z-10 rounded-md bg-zinc-100/80 px-1 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  >
                    +{dayEvents.length - 2}
                  </button>
                )}
              </div>

              {/* Selection Handles */}
              {isStart && (
                <div
                  className='absolute top-0 bottom-0 left-0 z-40 flex w-6 cursor-ew-resize touch-none items-center justify-center'
                  onPointerDown={(e) => handleResizeStart(e, 'start')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='h-8 w-1.5 rounded-full border border-white bg-indigo-600 shadow-sm dark:border-zinc-900 dark:bg-indigo-400' />
                </div>
              )}
              {isEnd && (
                <div
                  className='absolute top-0 right-0 bottom-0 z-40 flex w-6 cursor-ew-resize touch-none items-center justify-center'
                  onPointerDown={(e) => handleResizeStart(e, 'end')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='h-8 w-1.5 rounded-full border border-white bg-indigo-600 shadow-sm dark:border-zinc-900 dark:bg-indigo-400' />
                </div>
              )}

              {/* Selection Overlay Click Handler */}
              {isSelected && !resizeState && (
                <div
                  className='absolute inset-0 z-30'
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleSelectionClick}
                />
              )}

              <div className='relative px-0.5 sm:px-1'>
                {/* Sort events by their assigned level */}
                {dayEvents
                  .map((event) => ({
                    event,
                    layout: eventLayout.get(event.id),
                  }))
                  .sort(
                    (a, b) => (a.layout?.level || 0) - (b.layout?.level || 0)
                  )
                  .slice(0, 2)
                  .map(({ event, layout }) => {
                    const eventStart = startOfDay(new Date(event.start * 1000));
                    const eventEnd = event.end
                      ? startOfDay(new Date(event.end * 1000))
                      : eventStart;
                    const currentDay = startOfDay(day);

                    const isStartDay = isSameDay(currentDay, eventStart);
                    const isEndDay = isSameDay(currentDay, eventEnd);
                    const isMultiDay = !isSameDay(eventStart, eventEnd);

                    const color = layout?.color || getEventColor(event.id);
                    const level = layout?.level || 0;
                    const isViewedContact =
                      selectedContactPubkeys.includes(event.pubkey) &&
                      event.pubkey !== pubkey;

                    return (
                      <div
                        key={event.id}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        style={{
                          position: 'absolute',
                          top: `${level * 24}px`,
                          left: 0,
                          right: 0,
                          zIndex: 10 - level,
                          backgroundColor: event.color,
                          borderColor: event.color,
                        }}
                        className={cn(
                          'group relative h-[22px] touch-manipulation border border-transparent',
                          !event.color && [
                            color.bg,
                            color.text,
                            color.darkBg,
                            color.darkText,
                            `hover:${color.border}`,
                          ],
                          event.color && 'text-white',
                          isViewedContact &&
                            'ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-zinc-900',
                          'flex items-center px-1 text-[11px] sm:px-1.5 sm:text-xs',
                          'hover:opacity-90 active:opacity-80',
                          !isMultiDay && 'mx-0.5 rounded sm:mx-1',
                          isMultiDay && [
                            isStartDay && '-mr-px ml-0.5 rounded-l sm:ml-1',
                            isEndDay && 'mr-0.5 -ml-px rounded-r sm:mr-1',
                            !isStartDay && !isEndDay && '-mx-px rounded-none',
                          ]
                        )}
                      >
                        {/* Left accent bar */}
                        <div
                          className={cn(
                            'absolute top-0 bottom-0 left-0 w-1 opacity-60',
                            !event.color && color.text.replace('text-', 'bg-'),
                            event.color && 'bg-white/40'
                          )}
                          style={
                            isViewedContact
                              ? {
                                  backgroundImage: `repeating-linear-gradient(
                                    0deg,
                                    transparent,
                                    transparent 2px,
                                    rgba(255, 255, 255, 0.4) 2px,
                                    rgba(255, 255, 255, 0.4) 4px
                                  )`,
                                }
                              : undefined
                          }
                        />
                        <div className='flex min-w-0 flex-1 items-center gap-0.5 truncate font-medium sm:gap-1'>
                          {(isStartDay || !isMultiDay) && (
                            <>
                              {event.reminderMinutes &&
                                event.reminderMinutes > 0 && (
                                  <Bell className='h-2.5 w-2.5 flex-shrink-0 opacity-70' />
                                )}
                              <span className='truncate'>{event.title}</span>
                              {event.parent && (
                                <Repeat className='h-2.5 w-2.5 flex-shrink-0 opacity-70' />
                              )}
                              {event.isPrivate && (
                                <Lock className='h-2.5 w-2.5 flex-shrink-0 opacity-70' />
                              )}
                              {event.invitees.length > 0 && (
                                <>
                                  {event.pubkey === pubkey ? (
                                    <LucidePersonStanding className='h-2.5 w-2.5 flex-shrink-0 opacity-70' />
                                  ) : (
                                    <LucideUsers className='h-2.5 w-2.5 flex-shrink-0 opacity-70' />
                                  )}
                                </>
                              )}
                            </>
                          )}
                          {isMultiDay && !isStartDay && (
                            <span className='truncate opacity-75'>
                              {isEndDay ? `${event.title} (ends)` : event.title}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

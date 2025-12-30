import { useState, useRef, useEffect } from 'react';
import {
  format,
  isToday,
  isSameDay,
  addMinutes,
  startOfDay,
  endOfDay,
  differenceInMinutes,
} from 'date-fns';
import {
  Lock,
  PersonStanding,
  Loader2,
  Users,
  ZoomIn,
  ZoomOut,
  Repeat,
} from 'lucide-react';
import { cn, getEventColor } from '@/lib/utils';
import { ViewProps } from '../Calendar';
import { ParsedEvent } from '@/lib/nostr-utils';
import { useAppStore } from '@/lib/store';

interface DayEventLayout {
  event: ParsedEvent;
  visualStart: Date;
  visualEnd: Date;
  startMin: number;
  endMin: number;
  col: number;
  width: number;
  left: number;
}

function packEvents(events: DayEventLayout[]) {
  // Sort by start time, then duration
  const sorted = [...events].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin; // Longer events first if start same
  });

  const groups: DayEventLayout[][] = [];
  let currentGroup: DayEventLayout[] = [];
  let groupEnd = -1;

  for (const event of sorted) {
    if (currentGroup.length === 0 || event.startMin < groupEnd) {
      currentGroup.push(event);
      groupEnd = Math.max(groupEnd, event.endMin);
    } else {
      groups.push(currentGroup);
      currentGroup = [event];
      groupEnd = event.endMin;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Layout each group
  for (const group of groups) {
    const groupColumns: number[] = [];

    for (const event of group) {
      let placed = false;
      for (let i = 0; i < groupColumns.length; i++) {
        if (groupColumns[i] <= event.startMin) {
          event.col = i;
          groupColumns[i] = event.endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        event.col = groupColumns.length;
        groupColumns.push(event.endMin);
      }
    }

    const width = 100 / groupColumns.length;
    for (const event of group) {
      event.left = event.col * width;
      event.width = width;
    }
  }

  return sorted;
}

export default function DayView({
  currentDate,
  events,
  isLoading,
  onEventClick,
  onDateClick,
  onSelectionChange,
}: ViewProps) {
  const days = [currentDate];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [isCompact, setIsCompact] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pubkey, selectedContactPubkeys } = useAppStore();
  const [selection, setSelection] = useState<{
    day: Date;
    startMin: number;
    endMin: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<'start' | 'end' | null>(null);

  // Sync selection to parent
  useEffect(() => {
    if (onSelectionChange) {
      if (selection) {
        const startBase = startOfDay(selection.day);
        const startDate = addMinutes(startBase, selection.startMin);
        const endDate = addMinutes(startBase, selection.endMin);
        onSelectionChange({ start: startDate, end: endDate });
      } else {
        onSelectionChange(null);
      }
    }
  }, [selection, onSelectionChange]);

  const getMinuteFromY = (y: number) => {
    const containerHeight =
      containerRef.current?.scrollHeight || (isCompact ? 403 : 1440);
    const pixelsPerMinute = containerHeight / 1440;
    const raw = y / pixelsPerMinute;
    return Math.round(raw / 15) * 15;
  };

  const handleGridClick = (e: React.MouseEvent, day: Date) => {
    if (resizeState || e.button !== 0) return;

    const minute = getMinuteFromY(e.nativeEvent.offsetY);
    setSelection({
      day,
      startMin: minute,
      endMin: Math.min(minute + 60, 1440),
    });
  };

  const handleResizeStart = (e: React.PointerEvent, type: 'start' | 'end') => {
    e.stopPropagation();
    setResizeState(type);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizeState || !selection) return;

    const containerRec = containerRef.current?.getBoundingClientRect();
    if (!containerRec) return;

    const currentY =
      e.clientY - containerRec.top + containerRef.current!.scrollTop;
    const newMinute = Math.min(Math.max(getMinuteFromY(currentY), 0), 1440);

    setSelection((prev) => {
      if (!prev) return null;
      let { startMin, endMin } = prev;

      if (resizeState === 'start') {
        startMin = newMinute;
      } else {
        endMin = newMinute;
      }

      return { ...prev, startMin, endMin };
    });
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    setResizeState(null);
    e.currentTarget.releasePointerCapture(e.pointerId);

    setSelection((prev) => {
      if (!prev) return null;
      let { startMin, endMin } = prev;
      if (startMin > endMin) {
        const temp = startMin;
        startMin = endMin;
        endMin = temp;
      }
      if (endMin - startMin < 15) {
        endMin = startMin + 15;
      }
      return { ...prev, startMin, endMin };
    });
  };

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selection) {
      const startBase = startOfDay(selection.day);
      const startDate = addMinutes(startBase, selection.startMin);
      const endDate = addMinutes(startBase, selection.endMin);
      onDateClick(startDate, endDate);
      setSelection(null);
    }
  };

  return (
    <div
      className='flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950'
      onMouseLeave={() => {}}
    >
      {/* Header */}
      <div className='flex border-b border-zinc-200 bg-zinc-50/30 dark:border-zinc-800 dark:bg-zinc-900/30'>
        <div className='flex w-8 flex-shrink-0 items-center justify-center border-r border-zinc-200 dark:border-zinc-800'>
          <button
            onClick={() => setIsCompact(!isCompact)}
            className='p-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          >
            {isCompact ? (
              <ZoomIn className='h-4 w-4' />
            ) : (
              <ZoomOut className='h-4 w-4' />
            )}
          </button>
        </div>
        <div className='flex-1'>
          {days.map((day) => (
            <div
              key={day.toString()}
              className='py-3 text-center sm:py-2'
              onClick={() => onDateClick(day)}
            >
              <div
                className={cn(
                  'text-xs font-semibold uppercase',
                  isToday(day)
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-500'
                )}
              >
                {format(day, 'EEEE')}
              </div>
              <div
                className={cn(
                  'mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium',
                  isToday(day)
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-900 dark:text-zinc-100'
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className='flex flex-1 overflow-y-auto' ref={containerRef}>
        <div
          className='relative flex w-full'
          style={{
            height: isCompact ? '100%' : '1440px',
            minHeight: '100%',
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
          <div className='flex w-8 flex-shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/30 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30'>
            {hours.map((hour) => (
              <div
                key={hour}
                className='relative flex-1 border-b border-transparent pr-2 text-right'
              >
                <span className='absolute top-0 right-2 hidden sm:block'>
                  {hour.toString()}
                </span>
                <span className='absolute top-0 right-2 sm:hidden'>{hour}</span>
              </div>
            ))}
          </div>

          <div className='grid flex-1 grid-cols-1 divide-x divide-zinc-200 dark:divide-zinc-800'>
            {days.map((day) => {
              const dayStart = startOfDay(day);
              const dayEnd = endOfDay(day);

              // 1. Filter and prepare events for this day
              const dayEventsRaw = events.filter((e) => {
                const start = new Date(e.start * 1000);
                let end = e.end
                  ? new Date(e.end * 1000)
                  : addMinutes(start, 60);

                // Ensure minimal duration for overlap check
                if (start.getTime() === end.getTime()) {
                  end = addMinutes(start, 15);
                }

                // Check overlap: Start < DayEnd && End > DayStart
                return start < dayEnd && end > dayStart;
              });

              // 2. Clamp events to day boundaries and prepare for layout
              const layoutEvents: DayEventLayout[] = dayEventsRaw.map((e) => {
                let visualStart: Date;
                let visualEnd: Date;

                if (e.isAllDay) {
                  visualStart = dayStart;
                  visualEnd = dayEnd;
                } else {
                  const actualStart = new Date(e.start * 1000);
                  let actualEnd = e.end
                    ? new Date(e.end * 1000)
                    : addMinutes(actualStart, 60);

                  // Ensure minimal duration for visualization
                  if (actualEnd.getTime() <= actualStart.getTime()) {
                    actualEnd = addMinutes(actualStart, 15);
                  }

                  visualStart = actualStart < dayStart ? dayStart : actualStart;
                  visualEnd = actualEnd > dayEnd ? dayEnd : actualEnd;
                }

                const startMin = differenceInMinutes(visualStart, dayStart);
                let duration = differenceInMinutes(visualEnd, visualStart);
                if (!e.isAllDay && duration < 15) duration = 15;
                if (e.isAllDay) duration = 1440; // Force full day

                return {
                  event: e,
                  visualStart,
                  visualEnd,
                  startMin,
                  endMin: startMin + duration,
                  col: 0,
                  width: 100,
                  left: 0,
                };
              });

              // 3. Compute layout
              const positionedEvents = packEvents(layoutEvents);

              // Selection Layout
              const isSelectedDay = selection && isSameDay(selection.day, day);

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    'relative flex flex-1 flex-col bg-white dark:bg-zinc-950/50',
                    resizeState && 'touch-none'
                  )}
                  onClick={(e) => handleGridClick(e, day)}
                >
                  {/* Current time indicator */}
                  {isToday(day) && (
                    <div
                      className='pointer-events-none absolute right-0 left-0 z-40 border-t-2 border-red-500 before:absolute before:-top-[5px] before:-left-1 before:h-2 before:w-2 before:rounded-full before:bg-red-500'
                      style={{
                        top: `${
                          ((day.getHours() * 60 + day.getMinutes()) / 1440) *
                          100
                        }%`,
                      }}
                    />
                  )}

                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className='pointer-events-none relative flex-1 border-b border-zinc-100 dark:border-zinc-800/50'
                    >
                      <div
                        className='absolute right-0 left-0 border-t border-dotted border-zinc-100/30 dark:border-zinc-800/20'
                        style={{ top: '25%' }}
                      />
                      <div
                        className='absolute right-0 left-0 border-t border-dashed border-zinc-100/60 dark:border-zinc-800/30'
                        style={{ top: '50%' }}
                      />
                      <div
                        className='absolute right-0 left-0 border-t border-dotted border-zinc-100/30 dark:border-zinc-800/20'
                        style={{ top: '75%' }}
                      />
                    </div>
                  ))}

                  {/* Selection Overlay */}
                  {isSelectedDay && (
                    <div
                      className='absolute right-2 left-1 z-30 rounded-md border-2 border-indigo-600 bg-indigo-500/20 select-none dark:border-indigo-400'
                      style={{
                        top: `${(selection.startMin / 1440) * 100}%`,
                        height: `${
                          ((selection.endMin - selection.startMin) / 1440) * 100
                        }%`,
                        minHeight: '1px',
                        display: 'block',
                      }}
                    >
                      <div
                        className='absolute inset-0 z-30 cursor-pointer'
                        onClick={handleSelectionClick}
                      />

                      {/* Top Handle */}
                      <div
                        className='absolute -top-3 right-0 left-0 z-40 flex h-6 cursor-ns-resize touch-none items-center justify-center'
                        onPointerDown={(e) => handleResizeStart(e, 'start')}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeEnd}
                        onPointerCancel={handleResizeEnd}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className='h-1.5 w-8 rounded-full border border-white bg-indigo-600 shadow-sm dark:border-zinc-900 dark:bg-indigo-400' />
                      </div>

                      {/* Bottom Handle */}
                      <div
                        className='absolute right-0 -bottom-3 left-0 z-40 flex h-6 cursor-ns-resize touch-none items-center justify-center'
                        onPointerDown={(e) => handleResizeStart(e, 'end')}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeEnd}
                        onPointerCancel={handleResizeEnd}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className='h-1.5 w-8 rounded-full border border-white bg-indigo-600 shadow-sm dark:border-zinc-900 dark:bg-indigo-400' />
                      </div>
                    </div>
                  )}

                  {positionedEvents.map(
                    ({ event, startMin, endMin, left, width }) => {
                      const duration = endMin - startMin;
                      const color = getEventColor(event.id);
                      const formattedTime = format(
                        new Date(event.start * 1000),
                        'HH:mm'
                      );
                      const isViewedContact =
                        selectedContactPubkeys.includes(event.pubkey) &&
                        event.pubkey !== pubkey;

                      return (
                        <div
                          key={event.id + day.toString()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className={cn(
                            'absolute z-20 mx-1 cursor-pointer overflow-hidden rounded border border-white/20 p-1 text-xs shadow-sm hover:opacity-90',
                            !event.color && [
                              color.bg,
                              color.text,
                              color.darkBg,
                              color.darkText,
                            ],
                            event.color && 'text-white',
                            isViewedContact &&
                              'ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-zinc-900'
                          )}
                          style={{
                            top: `${(startMin / 1440) * 100}%`,
                            height: `${(duration / 1440) * 100}%`,
                            left: `${left}%`,
                            width: `${width}%`,
                            backgroundColor: event.color,
                            borderColor: event.color,
                          }}
                        >
                          {/* Left accent bar */}
                          <div
                            className={cn(
                              'absolute top-0 bottom-0 left-0 w-1 opacity-60',
                              !event.color &&
                                color.text.replace('text-', 'bg-'),
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
                          <div className='flex items-center gap-1 overflow-hidden font-semibold'>
                            <span className='truncate'>{event.title}</span>
                            {event.isPrivate && (
                              <Lock className='h-3 w-3 flex-shrink-0' />
                            )}
                            {event.parent && (
                              <Repeat className='h-3 w-3 flex-shrink-0' />
                            )}
                            {event.invitees.length > 0 && (
                              <>
                                {event.pubkey === pubkey ? (
                                  <PersonStanding className='h-3 w-3 flex-shrink-0' />
                                ) : (
                                  <Users className='h-3 w-3 flex-shrink-0' />
                                )}
                              </>
                            )}
                          </div>
                          <div className='truncate'>{formattedTime}</div>
                        </div>
                      );
                    }
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

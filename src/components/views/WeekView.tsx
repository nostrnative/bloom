import { useState, useRef, useEffect } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  eachDayOfInterval,
  isToday,
  addMinutes,
  startOfDay,
  differenceInMinutes,
  endOfDay,
  isSameDay,
  isBefore,
  isAfter,
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

    const nCols = groupColumns.length;
    for (const event of group) {
      // Find how many columns this event can span
      let span = 1;
      while (event.col + span < nCols) {
        const nextCol = event.col + span;
        const hasOverlap = group.some(
          (other) =>
            other !== event &&
            other.col === nextCol &&
            other.startMin < event.endMin &&
            other.endMin > event.startMin
        );
        if (hasOverlap) break;
        span++;
      }

      event.left = (event.col / nCols) * 100;
      event.width = (span / nCols) * 100;
    }
  }

  return sorted;
}

export default function WeekView({
  currentDate,
  events,
  isLoading,
  onEventClick,
  onDateClick,
  onSelectionChange,
}: ViewProps) {
  const startDate = startOfWeek(currentDate);
  const days = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 6),
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [isCompact, setIsCompact] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pubkey, selectedContactPubkeys } = useAppStore();

  const [selection, setSelection] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [dragState, setDragState] = useState<
    'creating' | 'resizing-start' | 'resizing-end' | null
  >(null);
  const now = new Date();

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

  const getMinuteFromY = (y: number) => {
    const containerHeight =
      containerRef.current?.scrollHeight || (isCompact ? 403 : 1440);
    const pixelsPerMinute = containerHeight / 1440;
    const raw = y / pixelsPerMinute;
    return Math.round(raw / 15) * 15;
  };

  const getDateFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const containerRec = containerRef.current?.getBoundingClientRect();
    if (!containerRec) return null;

    const x = e.clientX - containerRec.left - 64;
    const colWidth = (containerRec.width - 64) / 7;
    const dayIndex = Math.max(0, Math.min(6, Math.floor(x / colWidth)));
    const day = days[dayIndex];

    const y =
      e.clientY - containerRec.top + (containerRef.current?.scrollTop || 0);
    const minute = Math.min(Math.max(getMinuteFromY(y), 0), 1439);

    return addMinutes(startOfDay(day), minute);
  };

  const handleGridPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const date = getDateFromEvent(e);
    if (!date) return;

    setSelection({ start: date, end: addMinutes(date, 60) });
    setDragState('creating');
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (
    e: React.PointerEvent,
    type: 'resizing-start' | 'resizing-end'
  ) => {
    e.stopPropagation();
    setDragState(type);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !selection) return;

    const newDate = getDateFromEvent(e);
    if (!newDate) return;

    setSelection((prev) => {
      if (!prev) return null;
      if (dragState === 'creating' || dragState === 'resizing-end') {
        return { ...prev, end: newDate };
      } else {
        return { ...prev, start: newDate };
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;
    setDragState(null);
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Normalize selection
    setSelection((prev) => {
      if (!prev) return null;
      let { start, end } = prev;
      if (isBefore(end, start)) {
        [start, end] = [end, start];
      }
      if (differenceInMinutes(end, start) < 15) {
        end = addMinutes(start, 15);
      }
      return { start, end };
    });
  };

  const handleSelectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selection) {
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
        <div className='grid flex-1 grid-cols-7'>
          {days.map((day) => (
            <div key={day.toString()} className='py-3 text-center sm:py-2'>
              <div
                className={cn(
                  'text-xs font-semibold uppercase',
                  isToday(day)
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-500'
                )}
              >
                {format(day, 'EEE')}
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

      {/* Scrollable Time Grid */}
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

          {/* Grid Content */}
          <div
            className={cn(
              'grid flex-1 grid-cols-7 divide-x divide-zinc-200 dark:divide-zinc-800',
              dragState && 'touch-none'
            )}
            onPointerDown={handleGridPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {days.map((day) => {
              const dayStart = startOfDay(day);
              const dayEnd = endOfDay(day);

              const dayEventsRaw = events.filter((e) => {
                const start = new Date(e.start * 1000);
                let end = e.end
                  ? new Date(e.end * 1000)
                  : addMinutes(start, 60);
                if (start.getTime() === end.getTime()) {
                  end = addMinutes(start, 15);
                }
                return start < dayEnd && end > dayStart;
              });

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
                  if (actualEnd.getTime() <= actualStart.getTime()) {
                    actualEnd = addMinutes(actualStart, 15);
                  }
                  visualStart = actualStart < dayStart ? dayStart : actualStart;
                  visualEnd = actualEnd > dayEnd ? dayEnd : actualEnd;
                }

                const startMin = differenceInMinutes(visualStart, dayStart);
                let duration = differenceInMinutes(visualEnd, visualStart);
                if (!e.isAllDay && duration < 15) duration = 15;
                if (e.isAllDay) duration = 1440;

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

              const positionedEvents = packEvents(layoutEvents);

              const isOverlapping =
                renderSelection &&
                renderSelection.start < dayEnd &&
                renderSelection.end > dayStart;

              let visualStartMin = 0;
              let visualEndMin = 0;
              if (isOverlapping && renderSelection) {
                const visualStart =
                  renderSelection.start < dayStart
                    ? dayStart
                    : renderSelection.start;
                const visualEnd =
                  renderSelection.end > dayEnd ? dayEnd : renderSelection.end;
                visualStartMin = differenceInMinutes(visualStart, dayStart);
                visualEndMin = differenceInMinutes(visualEnd, dayStart);
              }

              return (
                <div
                  key={day.toString()}
                  className='group/day relative flex flex-1 flex-col bg-white transition-colors duration-200 hover:bg-zinc-50/50 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/30'
                >
                  {/* Current time indicator */}
                  {isToday(day) && (
                    <div
                      className='pointer-events-none absolute right-0 left-0 z-40 border-t-2 border-red-500 before:absolute before:-top-[5px] before:-left-1 before:h-2 before:w-2 before:rounded-full before:bg-red-500'
                      style={{
                        top: `${
                          ((now.getHours() * 60 + now.getMinutes()) / 1440) *
                          100
                        }%`,
                      }}
                    />
                  )}

                  {/* Hour lines */}
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
                  {isOverlapping && renderSelection && (
                    <div
                      className='absolute right-1 left-1 z-30 rounded-lg border-2 border-indigo-500 bg-indigo-500/10 shadow-lg ring-1 ring-white/20 select-none dark:border-indigo-400 dark:bg-indigo-400/10'
                      style={{
                        top: `${(visualStartMin / 1440) * 100}%`,
                        height: `${Math.max(
                          ((visualEndMin - visualStartMin) / 1440) * 100,
                          0.1
                        )}%`,
                        display: 'block',
                      }}
                    >
                      {/* Overlay Click Handler */}
                      <div
                        className='absolute inset-0 z-30 cursor-pointer'
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={handleSelectionClick}
                      />

                      {/* Top Handle */}
                      {isSameDay(renderSelection.start, day) && (
                        <div
                          className='absolute -top-3 right-0 left-0 z-40 flex h-6 cursor-ns-resize touch-none items-center justify-center'
                          onPointerDown={(e) =>
                            handleResizePointerDown(e, 'resizing-start')
                          }
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className='h-2 w-10 rounded-full border-2 border-white bg-indigo-500 shadow-md transition-transform hover:scale-110 active:scale-95 dark:border-zinc-900' />
                        </div>
                      )}

                      {/* Bottom Handle */}
                      {isSameDay(renderSelection.end, day) && (
                        <div
                          className='absolute right-0 -bottom-3 left-0 z-40 flex h-6 cursor-ns-resize touch-none items-center justify-center'
                          onPointerDown={(e) =>
                            handleResizePointerDown(e, 'resizing-end')
                          }
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className='h-2 w-10 rounded-full border-2 border-white bg-indigo-500 shadow-md transition-transform hover:scale-110 active:scale-95 dark:border-zinc-900' />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Events */}
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
                            'group/event absolute z-20 cursor-pointer overflow-hidden rounded-md border p-1.5 text-[10px] shadow-sm transition-all duration-200 hover:z-50 hover:scale-[1.02] hover:shadow-md sm:text-xs',
                            !event.color && [
                              color.bg,
                              color.border,
                              color.text,
                              color.darkBg,
                              color.darkText,
                              'dark:border-white/10',
                            ],
                            event.color && 'text-white',
                            isViewedContact &&
                              'ring-2 ring-indigo-500 ring-offset-1 dark:ring-indigo-400 dark:ring-offset-zinc-900'
                          )}
                          style={{
                            top: `${(startMin / 1440) * 100}%`,
                            height: `${(duration / 1440) * 100}%`,
                            left: `calc(${left}% + 1px)`,
                            width: `calc(${width}% - 2px)`,
                            backgroundColor: event.color,
                            borderColor: event.color,
                          }}
                        >
                          {/* Left accent bar */}
                          <div
                            className={cn(
                              'absolute top-0 bottom-0 left-0 w-1 opacity-60 transition-opacity group-hover/event:opacity-100',
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

                          <div className='flex items-start justify-between gap-1 overflow-hidden pl-1'>
                            <div
                              className={cn(
                                'flex flex-col overflow-hidden',
                                width < 25 && 'w-full'
                              )}
                            >
                              <span
                                className={cn(
                                  'leading-tight font-bold',
                                  width < 25
                                    ? 'max-h-full py-1 [writing-mode:vertical-lr]'
                                    : 'truncate'
                                )}
                              >
                                {event.title}
                              </span>
                              {event.isPrivate && (
                                <Lock className='h-3 w-3 flex-shrink-0' />
                              )}
                              {event.parent && (
                                <Repeat className='h-3 w-3 flex-shrink-0' />
                              )}
                              {width >= 25 && (
                                <span className='truncate opacity-80'>
                                  {formattedTime}
                                </span>
                              )}
                            </div>
                            {event.invitees.length > 0 && width >= 15 && (
                              <div className='flex-shrink-0 pt-0.5'>
                                {event.pubkey === pubkey ? (
                                  <PersonStanding className='h-3 w-3' />
                                ) : (
                                  <Users className='h-3 w-3' />
                                )}
                              </div>
                            )}
                          </div>
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

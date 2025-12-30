import { useRef, useEffect, useState } from 'react';
import {
  format,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addYears,
  subYears,
  isSameYear,
  startOfDay,
  isSameDay,
} from 'date-fns';
import { ExternalLink, LayoutGrid, List, Loader2, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewProps } from '../Calendar';
import { ParsedEvent } from '@/lib/nostr-utils';

export default function YearView({
  currentDate,
  onViewSwitch,
  events,
  isLoading,
}: ViewProps) {
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('list');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);

  // Range of years relative to currentDate
  const years = Array.from({ length: 10 }, (_, i) =>
    addYears(subYears(startOfYear(currentDate), 2), i)
  );

  useEffect(() => {
    // Scroll to target month on mount, mode change, or when loading finishes
    if (!isLoading && currentMonthRef.current) {
      currentMonthRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [displayMode, isLoading, currentDate]);

  const viewToggle = (
    <div className='flex items-center gap-1 rounded-lg bg-zinc-100 p-1 shadow-sm dark:bg-zinc-900'>
      <button
        onClick={() => setDisplayMode('grid')}
        className={cn(
          'flex items-center gap-1.5 rounded-md p-1.5 text-xs font-medium transition-all',
          displayMode === 'grid'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
        )}
      >
        <LayoutGrid className='h-3.5 w-3.5' />
        <span className='hidden sm:inline'>Grid</span>
      </button>
      <button
        onClick={() => setDisplayMode('list')}
        className={cn(
          'flex items-center gap-1.5 rounded-md p-1.5 text-xs font-medium transition-all',
          displayMode === 'list'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
        )}
      >
        <List className='h-3.5 w-3.5' />
        <span className='hidden sm:inline'>List</span>
      </button>
    </div>
  );

  return (
    <div className='flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950'>
      <div
        className='custom-scrollbar flex-1 overflow-y-auto px-4 py-6'
        ref={scrollContainerRef}
      >
        <div className='mx-auto max-w-7xl'>
          {isLoading && (
            <div className='flex min-h-[200px] flex-col items-center justify-center gap-2'>
              <Loader2 className='h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400' />
              <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                Loading events...
              </p>
            </div>
          )}
          {!isLoading &&
            years.map((yearDate) => (
              <div key={yearDate.getFullYear()} className='mb-16 last:mb-0'>
                <div className='sticky top-[-30px] z-30 mb-8 flex items-center justify-between border-b border-zinc-100 bg-white/80 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80'>
                  <h2 className='text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100'>
                    {yearDate.getFullYear()}
                  </h2>
                  {viewToggle}
                </div>

                <div
                  className={cn(
                    displayMode === 'grid'
                      ? 'grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                      : 'space-y-12'
                  )}
                >
                  {eachMonthOfInterval({
                    start: startOfYear(yearDate),
                    end: endOfYear(yearDate),
                  }).map((monthDate) => {
                    const isTargetMonth =
                      isSameMonth(monthDate, currentDate) &&
                      isSameYear(monthDate, currentDate);

                    return (
                      <div
                        key={monthDate.toString()}
                        ref={isTargetMonth ? currentMonthRef : null}
                      >
                        {displayMode === 'grid' ? (
                          <MonthSmallGrid
                            monthDate={monthDate}
                            onViewSwitch={onViewSwitch}
                            events={events}
                          />
                        ) : (
                          <MonthListView
                            monthDate={monthDate}
                            onViewSwitch={onViewSwitch}
                            events={events}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

interface MonthSmallGridProps {
  monthDate: Date;
  onViewSwitch: ViewProps['onViewSwitch'];
  events: ParsedEvent[];
}

function MonthSmallGrid({
  monthDate,
  onViewSwitch,
  events,
}: MonthSmallGridProps) {
  const startDate = startOfWeek(startOfMonth(monthDate));
  const endDate = endOfWeek(endOfMonth(monthDate));
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const eventDays = new Set<string>();
  events.forEach((e) => {
    const start = new Date(e.start * 1000);
    const end = e.end ? new Date(e.end * 1000) : start;

    if (start <= monthEnd && end >= monthStart) {
      const intervalStart = start < monthStart ? monthStart : start;
      const intervalEnd = end > monthEnd ? monthEnd : end;

      try {
        eachDayOfInterval({
          start: startOfDay(intervalStart),
          end: startOfDay(intervalEnd),
        }).forEach((day) => {
          eventDays.add(day.toDateString());
        });
      } catch (e) {
        // Handle invalid intervals
      }
    }
  });

  return (
    <div className='group flex flex-col'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-bold text-zinc-800 dark:text-zinc-200'>
          {format(monthDate, 'MMMM')}
        </h3>
        <button
          onClick={() => onViewSwitch?.('month', monthDate)}
          className='rounded-md p-1.5 text-indigo-600 transition-all'
          title={`Go to ${format(monthDate, 'MMMM yyyy')}`}
        >
          <ExternalLink className='h-4 w-4' />
        </button>
      </div>
      <div className='mb-2 grid grid-cols-7'>
        {weekDays.map((d, i) => (
          <div
            key={i}
            className='text-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500'
          >
            {d}
          </div>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-y-1'>
        {days.map((day, idx) => {
          const hasEvent = eventDays.has(day.toDateString());
          return (
            <div
              key={idx}
              onClick={() =>
                isSameMonth(day, monthDate) && onViewSwitch?.('day', day)
              }
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-full text-[10px] transition-colors sm:text-[11px]',
                !isSameMonth(day, monthDate)
                  ? 'invisible'
                  : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800',
                isToday(day)
                  ? 'bg-indigo-600 font-bold text-white shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-500'
                  : 'text-zinc-600 dark:text-zinc-400'
              )}
            >
              <div className='flex flex-col items-center'>
                <span>{day.getDate()}</span>
                {hasEvent && (
                  <div
                    className={cn(
                      'absolute bottom-1 h-1 w-1 rounded-full',
                      isToday(day)
                        ? 'bg-white'
                        : 'bg-indigo-500 dark:bg-indigo-400'
                    )}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MonthListViewProps {
  monthDate: Date;
  onViewSwitch: ViewProps['onViewSwitch'];
  events: ParsedEvent[];
}

function MonthListView({
  monthDate,
  onViewSwitch,
  events,
}: MonthListViewProps) {
  const monthEvents = events
    .filter((e) => {
      const start = new Date(e.start * 1000);
      const end = e.end ? new Date(e.end * 1000) : start;
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      return start <= monthEnd && end >= monthStart;
    })
    .sort((a, b) => a.start - b.start);

  return (
    <div className='flex flex-col gap-8 md:flex-row md:items-start'>
      <div className='w-full flex-shrink-0 md:w-64'>
        <MonthSmallGrid
          monthDate={monthDate}
          onViewSwitch={onViewSwitch}
          events={events}
        />
      </div>

      <div className='flex-1'>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {monthEvents.length > 0 ? (
            monthEvents.map((event) => {
              const start = new Date(event.start * 1000);
              const end = event.end ? new Date(event.end * 1000) : start;
              const isRange = !isSameDay(start, end);

              return (
                <div
                  key={event.id}
                  onClick={() => onViewSwitch?.('day', start)}
                  className='flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80'
                >
                  <div className='mb-2 flex flex-wrap items-center gap-x-3 gap-y-1'>
                    <div
                      className='h-6 w-1 rounded-full'
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                    />
                    <span className='text-xs font-bold text-zinc-400 dark:text-zinc-500'>
                      {format(start, 'MMM d')}
                      {isRange && ` - ${format(end, 'MMM d')}`}
                    </span>
                    {!event.isAllDay && (
                      <span className='text-xs font-medium text-zinc-400'>
                        {format(start, 'HH:mm')}
                        {isRange && ` - ${format(end, 'HH:mm')}`}
                      </span>
                    )}
                  </div>
                  <h4 className='truncate font-bold text-zinc-800 dark:text-zinc-200'>
                    {event.title}
                    {event.parent && (
                      <Repeat className='ml-1 inline-block h-3 w-3 opacity-60' />
                    )}
                  </h4>
                  {event.location && (
                    <p className='mt-1 truncate text-xs text-zinc-500'>
                      {event.location}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className='flex h-full items-center justify-center rounded-xl border-2 border-dashed border-zinc-100 bg-zinc-50/30 p-8 dark:border-zinc-800 dark:bg-zinc-900/30'>
              <p className='text-sm font-medium text-zinc-400'>
                No events this month
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

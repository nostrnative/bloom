import { useMemo, useEffect, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { nostrApi, CalendarEventRequest } from '@/lib/api';
import { parseNostrEvent, ParsedEvent, parseRSVP } from '@/lib/nostr-utils';
import { useAppStore } from '@/lib/store';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addYears,
  subYears,
} from 'date-fns';

function getFetchParams(
  currentDate: Date,
  view: 'year' | 'month' | 'week' | 'day'
) {
  let rangeStart: number;
  let rangeEnd: number;
  let keyRange: string;
  let viewGroup: string;

  if (view === 'year') {
    const anchor = startOfYear(currentDate);
    // Large range for year view: 10 years
    rangeStart = Math.floor(subYears(anchor, 2).getTime() / 1000);
    rangeEnd = Math.floor(endOfYear(addYears(anchor, 7)).getTime() / 1000);
    keyRange = anchor.getFullYear().toString();
    viewGroup = 'year';
  } else {
    // Fetch 3 months: Previous, Current, Next
    const currentMonth = startOfMonth(currentDate);
    rangeStart = Math.floor(
      startOfMonth(subMonths(currentMonth, 1)).getTime() / 1000
    );
    rangeEnd = Math.floor(
      endOfMonth(addMonths(currentMonth, 1)).getTime() / 1000
    );
    keyRange = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
    viewGroup = 'detailed';
  }

  return { rangeStart, rangeEnd, keyRange, viewGroup };
}

export function useEvents(
  currentDate: Date,
  view: 'year' | 'month' | 'week' | 'day'
) {
  const {
    pubkey,
    selectedCalendarId,
    getAllRelays,
    onlyContacts,
    hideDeclinedEvents,
    useDifferentTimestamp,
    statusFilters,
    selectedContactPubkeys,
  } = useAppStore();
  const queryClient = useQueryClient();

  const fetchEvents = useCallback(
    async (params: ReturnType<typeof getFetchParams>) => {
      if (!pubkey) return [];

      const { rangeStart, rangeEnd } = params;

      let authors: string[] | undefined;
      if (selectedContactPubkeys.length > 0) {
        authors = [pubkey, ...selectedContactPubkeys];
      } else {
        // If no specific contacts selected, only fetch for self.
        // This fulfills the user's request to not always send the whole contact list.
        authors = [pubkey];
      }

      console.log(authors);
      const rawEvents = await nostrApi.fetchEvents(
        pubkey,
        getAllRelays(),
        useDifferentTimestamp ? rangeStart : undefined,
        useDifferentTimestamp ? rangeEnd : undefined,
        authors
      );

      const parsed = rawEvents.map(parseNostrEvent);

      const uniqueEventsMap = parsed.reduce(
        (acc, event) => {
          if (
            !acc[event.identifier] ||
            event.createdAt > acc[event.identifier].createdAt
          ) {
            acc[event.identifier] = event;
          }
          return acc;
        },
        {} as Record<string, ParsedEvent>
      );

      return Object.values(uniqueEventsMap);
    },
    [pubkey, getAllRelays, useDifferentTimestamp, selectedContactPubkeys]
  );

  const fetchParams = useMemo(
    () => getFetchParams(currentDate, view),
    [currentDate, view]
  );

  const eventsQuery = useQuery({
    queryKey: [
      'events',
      pubkey,
      fetchParams.viewGroup,
      fetchParams.keyRange,
      onlyContacts,
      useDifferentTimestamp,
      selectedContactPubkeys,
    ],
    queryFn: () => fetchEvents(fetchParams),
    enabled: !!pubkey,
    staleTime: 60000,
    gcTime: 300000, // 5 minutes
    refetchInterval: 60000,
    placeholderData: keepPreviousData,
  });

  // Fetch my RSVPs for filtering
  const userRSVPsQuery = useQuery({
    queryKey: ['userRSVPs', pubkey],
    queryFn: () =>
      pubkey ? nostrApi.fetchUserRSVPs(pubkey, getAllRelays()) : [],
    enabled: !!pubkey,
    staleTime: 60000,
  });

  const userRSVPMap = useMemo(() => {
    const map = new Map<string, 'accepted' | 'declined' | 'tentative'>();
    if (!userRSVPsQuery.data) return map;

    // Sort by created_at desc to get latest status
    const sorted = [...userRSVPsQuery.data].sort(
      (a, b) => b.created_at - a.created_at
    );

    sorted.forEach((ev) => {
      const parsed = parseRSVP(ev);
      if (parsed && !map.has(parsed.eventId)) {
        map.set(parsed.eventId, parsed.status);
      }
    });
    return map;
  }, [userRSVPsQuery.data]);

  // Prefetch next/prev windows
  useEffect(() => {
    if (!pubkey) return;

    const nextDate =
      view === 'year' ? addYears(currentDate, 1) : addMonths(currentDate, 1);
    const prevDate =
      view === 'year' ? subYears(currentDate, 1) : subMonths(currentDate, 1);

    const nextParams = getFetchParams(nextDate, view);
    const prevParams = getFetchParams(prevDate, view);

    const prefetch = (params: ReturnType<typeof getFetchParams>) => {
      queryClient.prefetchQuery({
        queryKey: [
          'events',
          pubkey,
          params.viewGroup,
          params.keyRange,
          onlyContacts,
          useDifferentTimestamp,
          selectedContactPubkeys,
        ],
        queryFn: () => fetchEvents(params),
        staleTime: 60000,
      });
    };

    prefetch(nextParams);
    prefetch(prevParams);
  }, [
    currentDate,
    view,
    pubkey,
    onlyContacts,
    useDifferentTimestamp,
    queryClient,
    fetchEvents,
    selectedContactPubkeys,
  ]);

  const publishEventMutation = useMutation({
    mutationFn: (_events: CalendarEventRequest[]) => {
      throw new Error('Publishing requires a private key (currently disabled)');
    },
    onMutate: async (newEvents) => {
      await queryClient.cancelQueries({ queryKey: ['events'] });
      const previousEvents = queryClient.getQueriesData({
        queryKey: ['events'],
      });

      queryClient.setQueriesData(
        { queryKey: ['events'] },
        (old: ParsedEvent[] | undefined) => {
          if (!old) return undefined;

          let updatedList = [...old];

          newEvents.forEach((req) => {
            // If editing, remove old event first
            if (req.old_event_id) {
              updatedList = updatedList.filter(
                (e) => e.id !== req.old_event_id
              );
            } else if (req.identifier) {
              // Try to remove by identifier if checking purely for update by d-tag (optional safety)
              // But usually old_event_id is passed for edits.
              // If not passed, we might duplicate if we don't check identifier.
              // Let's filter by identifier if it exists to be safe for updates/overwrites
              updatedList = updatedList.filter(
                (e) => e.identifier !== req.identifier || e.pubkey !== pubkey
              );
            }

            const tempEvent: ParsedEvent = {
              id: req.old_event_id || `temp-${Date.now()}-${Math.random()}`, // Use old ID or temp
              title: req.title,
              description: req.description || '',
              start: req.start,
              end: req.end,
              location: req.location,
              isAllDay: req.is_all_day,
              identifier: req.identifier,
              reminderMinutes: req.reminder_minutes,
              createdAt: Math.floor(Date.now() / 1000),
              kind: req.is_all_day ? 31922 : 31923,
              calendarIds: req.calendar_id ? [req.calendar_id] : [],
              color: req.color,
              pubkey: pubkey!,
              invitees: req.p_tags || [],
              isPrivate: req.is_private || false,
            };
            updatedList.push(tempEvent);
          });

          return updatedList;
        }
      );

      return { previousEvents };
    },
    onError: (_err, _newEvents, context) => {
      if (context?.previousEvents) {
        context.previousEvents.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (_id: string | string[]) => {
      throw new Error('Deleting requires a private key (currently disabled)');
    },
    onMutate: async (deletedEventId) => {
      await queryClient.cancelQueries({ queryKey: ['events'] });
      const previousEvents = queryClient.getQueriesData({
        queryKey: ['events'],
      });

      const idsToDelete = Array.isArray(deletedEventId)
        ? deletedEventId
        : [deletedEventId];

      queryClient.setQueriesData(
        { queryKey: ['events'] },
        (old: ParsedEvent[] | undefined) => {
          if (!old) return undefined;
          return old.filter((event) => !idsToDelete.includes(event.id));
        }
      );

      return { previousEvents };
    },
    onError: (_err, _id, context) => {
      if (context?.previousEvents) {
        context.previousEvents.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const filteredEvents = useMemo(() => {
    if (!eventsQuery.data) return [];

    return eventsQuery.data.filter((event) => {
      // 1. Calendar Filter
      if (
        selectedCalendarId &&
        !event.calendarIds.includes(selectedCalendarId)
      ) {
        return false;
      }

      // 2. Status Filter
      const isSelf = event.pubkey === pubkey;
      if (isSelf) {
        return statusFilters.self;
      }

      // Check RSVP for this event
      // Construct coordinate for a-tag match
      const coordinate = `${event.kind}:${event.pubkey}:${event.identifier}`;
      const status = userRSVPMap.get(coordinate) || userRSVPMap.get(event.id);

      if (status === 'declined') {
        if (hideDeclinedEvents) return false;
        return statusFilters.declined;
      }
      if (status === 'accepted') return statusFilters.accepted;
      if (status === 'tentative') return statusFilters.tentative;

      // No status (Invited/None) - Show by default unless we add a filter for it
      // For now, treat as visible
      return true;
    });
  }, [
    eventsQuery.data,
    selectedCalendarId,
    hideDeclinedEvents,
    statusFilters,
    pubkey,
    userRSVPMap,
  ]);

  return {
    events: filteredEvents,
    allEvents: eventsQuery.data || [],
    isLoading: eventsQuery.isLoading,
    publishEvents: publishEventMutation.mutateAsync,
    isPublishing: publishEventMutation.isPending,
    deleteEvent: deleteEventMutation.mutateAsync,
    isDeleting: deleteEventMutation.isPending,
    refetch: eventsQuery.refetch,
  };
}

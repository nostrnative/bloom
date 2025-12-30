import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nostrApi, CalendarRequest } from '@/lib/api';
import { parseCalendar } from '@/lib/nostr-utils';
import { useAppStore } from '@/lib/store';

export function useCalendars() {
  const { pubkey, nsec, getAllRelays } = useAppStore();
  const queryClient = useQueryClient();

  const calendarsQuery = useQuery({
    queryKey: ['calendars', pubkey],
    queryFn: async () => {
      if (!pubkey) return [];
      const events = await nostrApi.fetchCalendars(pubkey, getAllRelays());
      return events.map(parseCalendar);
    },
    enabled: !!pubkey,
  });

  const createCalendarMutation = useMutation({
    mutationFn: (calendar: CalendarRequest) => {
      if (!nsec) throw new Error('No nsec');
      return nostrApi.publishCalendar(nsec, getAllRelays(), calendar);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars', pubkey] });
    },
  });

  const deleteCalendarMutation = useMutation({
    mutationFn: (identifier: string) => {
      if (!nsec) throw new Error('No nsec');
      return nostrApi.deleteCalendar(nsec, getAllRelays(), identifier);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars', pubkey] });
    },
  });

  return {
    calendars: calendarsQuery.data || [],
    isLoading: calendarsQuery.isLoading,
    createCalendar: createCalendarMutation.mutateAsync,
    isCreating: createCalendarMutation.isPending,
    deleteCalendar: deleteCalendarMutation.mutateAsync,
    isDeleting: deleteCalendarMutation.isPending,
  };
}

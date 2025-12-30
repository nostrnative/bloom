import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nostrApi } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { ParsedRSVP, parseRSVP } from '@/lib/nostr-utils';

export function useRSVPs(eventCoordinate?: string, eventAuthor?: string) {
  const { nsec, pubkey, getAllRelays } = useAppStore();
  const queryClient = useQueryClient();

  const rsvpsQuery = useQuery({
    queryKey: ['rsvps', eventCoordinate],
    queryFn: async () => {
      if (!eventCoordinate || !pubkey) return [];
      const rawEvents = await nostrApi.fetchRSVPs(
        eventCoordinate,
        getAllRelays()
      );
      return rawEvents
        .map(parseRSVP)
        .filter((r): r is ParsedRSVP => r !== null)
        .sort((a, b) => b.createdAt - a.createdAt); // Latest first
    },
    enabled: !!eventCoordinate && !!pubkey,
    staleTime: 60000,
  });

  const publishRSVPMutation = useMutation({
    mutationFn: async (status: 'accepted' | 'declined' | 'tentative') => {
      if (!nsec || !eventCoordinate) throw new Error('Missing nsec or event');
      return nostrApi.publishRSVP(
        nsec,
        getAllRelays(),
        eventCoordinate,
        status,
        eventAuthor
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rsvps', eventCoordinate] });
    },
  });

  // Unique RSVPs (one per pubkey, latest counts)
  const uniqueRSVPs = (rsvpsQuery.data || []).reduce(
    (acc, rsvp) => {
      if (!acc[rsvp.pubkey] || acc[rsvp.pubkey].createdAt < rsvp.createdAt) {
        acc[rsvp.pubkey] = rsvp;
      }
      return acc;
    },
    {} as Record<string, ParsedRSVP>
  );

  const rsvpList = Object.values(uniqueRSVPs);
  const myRSVP = pubkey ? uniqueRSVPs[pubkey] : undefined;

  return {
    rsvps: rsvpList,
    isLoading: rsvpsQuery.isLoading,
    publishRSVP: publishRSVPMutation.mutateAsync,
    isPublishing: publishRSVPMutation.isPending,
    myRSVP,
  };
}

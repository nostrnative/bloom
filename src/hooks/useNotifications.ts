import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { nostrApi } from '@/lib/api';
import { parseRSVP, parseNostrEvent, ParsedEvent } from '@/lib/nostr-utils';
import { useMemo } from 'react';

export interface NotificationItem {
  id: string; // RSVP Event ID
  pubkey: string;
  status: 'accepted' | 'declined' | 'tentative';
  eventId: string; // Parent Event ID
  createdAt: number;
  eventTitle?: string;
  eventStart?: number;
  event?: ParsedEvent;
}

export function useNotifications() {
  const {
    pubkey,
    getAllRelays,
    lastNotificationVisit,
    setLastNotificationVisit,
  } = useAppStore();

  // 1. Fetch received RSVPs
  const rsvpsQuery = useQuery({
    queryKey: ['notifications', 'rsvps', pubkey],
    queryFn: () =>
      pubkey ? nostrApi.fetchReceivedRSVPs(pubkey, getAllRelays()) : [],
    enabled: !!pubkey,
    staleTime: 60000,
    refetchInterval: 60000, // Check every minute
  });

  // 2. Fetch All My Events (to map RSVPs to titles)
  const eventsQuery = useQuery({
    queryKey: ['events', pubkey, 'all'],
    queryFn: async () => {
      if (!pubkey) return [];
      const rawEvents = await nostrApi.fetchEvents(
        pubkey,
        getAllRelays()
        // No range limits -> fetch all
      );
      return rawEvents.map(parseNostrEvent);
    },
    enabled: !!pubkey,
    staleTime: 300000, // 5 minutes
  });

  // 3. Combine Data
  const notifications: NotificationItem[] = useMemo(() => {
    if (!rsvpsQuery.data) return [];

    const eventMap = new Map<string, ParsedEvent>();
    if (eventsQuery.data) {
      eventsQuery.data.forEach((e) => {
        eventMap.set(e.id, e);
        if (e.identifier) {
          const coord = `${e.kind}:${e.pubkey}:${e.identifier}`;
          eventMap.set(coord, e);
        }
      });
    }

    const items: NotificationItem[] = [];

    rsvpsQuery.data.forEach((ev) => {
      if (ev.pubkey === pubkey) return; // Ignore self

      const parsed = parseRSVP(ev);
      if (!parsed) return;

      const parentEvent = eventMap.get(parsed.eventId);

      items.push({
        id: parsed.id,
        pubkey: parsed.pubkey,
        status: parsed.status,
        eventId: parsed.eventId,
        createdAt: parsed.createdAt,
        eventTitle: parentEvent?.title,
        eventStart: parentEvent?.start,
        event: parentEvent,
      });
    });

    // Sort by created_at desc
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [rsvpsQuery.data, eventsQuery.data, pubkey]);

  const hasUnread = useMemo(() => {
    if (notifications.length === 0) return false;
    return notifications[0].createdAt > lastNotificationVisit;
  }, [notifications, lastNotificationVisit]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.createdAt > lastNotificationVisit)
      .length;
  }, [notifications, lastNotificationVisit]);

  const markAllAsRead = () => {
    if (notifications.length > 0) {
      const newest = notifications[0].createdAt;
      if (newest > lastNotificationVisit) {
        setLastNotificationVisit(newest);
      }
    }
  };

  return {
    notifications,
    isLoading: rsvpsQuery.isLoading || eventsQuery.isLoading,
    hasUnread,
    unreadCount,
    markAllAsRead,
    refetch: async () => {
      await rsvpsQuery.refetch();
      await eventsQuery.refetch();
    },
  };
}

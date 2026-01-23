import { invoke } from '@tauri-apps/api/core';
import * as nostrNative from 'tauri-plugin-nostrnative';

export interface CalendarEventRequest {
  title: string;
  description?: string;
  start: number;
  end?: number;
  location?: string;
  identifier: string;
  reminder_minutes?: number;
  is_all_day: boolean;
  old_event_id?: string;
  calendar_id?: string;
  color?: string;
  p_tags?: string[];
  is_private?: boolean;
  parent?: string;
  freq?: string;
  until?: number;
  use_different_timestamp?: boolean;
}

export interface CalendarRequest {
  name: string;
  description?: string;
  identifier: string;
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  is_private: boolean;
}

export interface Contact {
  pubkey: string;
  alias?: string | null;
}

export interface UserProfile {
  pubkey: string;
  name?: string | null;
  display_name?: string | null;
  about?: string | null;
  picture?: string | null;
  banner?: string | null;
  website?: string | null;
  nip05?: string | null;
}

export const nostrApi = {
  verifyNsec: async (nsec: string): Promise<string> => {
    return await nostrNative.verifyNsec(nsec);
  },

  parsePubkey: async (pubkey: string): Promise<string> => {
    return await nostrNative.parsePubkey(pubkey);
  },

  generateNsec: async (): Promise<string> => {
    return await nostrNative.generateNewNsec();
  },

  fetchEvents: async (
    pubkey: string,
    relays: string[],
    nsec?: string,
    rangeStart?: number,
    rangeEnd?: number,
    authors?: string[]
  ): Promise<NostrEvent[]> => {
    return (await nostrNative.fetchCalendarEvents(pubkey, relays, {
      nsec,
      rangeStart,
      rangeEnd,
      authors,
    })) as unknown as NostrEvent[];
  },

  publishEvent: async (
    nsec: string,
    relays: string[],
    eventData: CalendarEventRequest
  ): Promise<string> => {
    return await nostrNative.publishCalendarEvent(
      nsec,
      relays,
      eventData as any
    );
  },

  publishBatchEvents: async (
    nsec: string,
    relays: string[],
    events: CalendarEventRequest[]
  ): Promise<string[]> => {
    return await nostrNative.publishBatchCalendarEvents(
      nsec,
      relays,
      events as any
    );
  },

  deleteEvent: async (
    nsec: string,
    relays: string[],
    eventId: string | string[]
  ): Promise<string> => {
    const eventIds = Array.isArray(eventId) ? eventId : [eventId];
    return await nostrNative.deleteCalendarEvent(nsec, relays, eventIds);
  },

  fetchContactList: async (
    pubkey: string,
    relays: string[]
  ): Promise<Contact[]> => {
    return (await nostrNative.fetchContactList(
      pubkey,
      relays
    )) as unknown as Contact[];
  },

  updateContactList: async (
    nsec: string,
    relays: string[],
    contacts: Contact[]
  ): Promise<string> => {
    return await nostrNative.updateContactList(nsec, relays, contacts as any);
  },

  fetchProfiles: async (
    pubkeys: string[],
    relays: string[]
  ): Promise<UserProfile[]> => {
    return (await nostrNative.fetchProfiles(
      pubkeys,
      relays
    )) as unknown as UserProfile[];
  },

  sendDirectMessage: async (
    nsec: string,
    receiverPubkey: string,
    message: string,
    relays: string[]
  ): Promise<string> => {
    return await nostrNative.sendDirectMessage(
      nsec,
      receiverPubkey,
      message,
      relays
    );
  },

  updateReminderSettings: async (settings: {
    pubkey: string | null;
    relays: string[];
    interval_minutes: number;
    enabled: boolean;
    only_contacts: boolean;
  }): Promise<void> => {
    return await invoke('update_reminder_settings', { settings });
  },

  fetchCalendars: async (
    pubkey: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return (await nostrNative.fetchCalendars(
      pubkey,
      relays
    )) as unknown as NostrEvent[];
  },

  publishCalendar: async (
    nsec: string,
    relays: string[],
    calendar: CalendarRequest
  ): Promise<string> => {
    return await nostrNative.publishCalendar(nsec, relays, calendar as any);
  },

  deleteCalendar: async (
    nsec: string,
    relays: string[],
    identifier: string
  ): Promise<string> => {
    return await nostrNative.deleteCalendar(nsec, relays, identifier);
  },

  fetchRSVPs: async (
    eventCoordinate: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return (await nostrNative.fetchRsvps(
      eventCoordinate,
      relays
    )) as unknown as NostrEvent[];
  },

  fetchUserRSVPs: async (
    pubkey: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return (await nostrNative.fetchUserRsvps(
      pubkey,
      relays
    )) as unknown as NostrEvent[];
  },

  fetchReceivedRSVPs: async (
    pubkey: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return (await nostrNative.fetchReceivedRsvps(
      pubkey,
      relays
    )) as unknown as NostrEvent[];
  },

  publishRSVP: async (
    nsec: string,
    relays: string[],
    eventCoordinate: string,
    status: 'accepted' | 'declined' | 'tentative',
    eventAuthor?: string
  ): Promise<string> => {
    return await nostrNative.publishRsvp(
      nsec,
      relays,
      eventCoordinate,
      status,
      eventAuthor
    );
  },

  updateSyncSettings: async (settings: {
    local_relay: string | null;
    remote_relays: string[];
    pubkey: string | null;
    nsec: string | null;
    interval_minutes: number;
    enabled: boolean;
    only_contacts: boolean;
    last_sync_timestamp: number | null;
    interested_contact_pubkeys: string[];
  }): Promise<void> => {
    return await invoke('update_sync_settings', { settings });
  },

  triggerSync: async (): Promise<void> => {
    return await invoke('trigger_sync');
  },
  getRelayStatus: async (): Promise<boolean> => {
    return await nostrNative.getNostrRelayStatus();
  },
  startRelay: async (port: number, dbPath: string): Promise<void> => {
    return await nostrNative.startNostrRelay(port, dbPath);
  },
  stopRelay: async (): Promise<void> => {
    return await nostrNative.stopNostrRelay();
  },
  getRelayEventCounts: async (): Promise<Record<number, number>> => {
    return await nostrNative.getNostrEventCounts() as Record<number, number>;
  },
};

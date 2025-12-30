import { invoke } from '@tauri-apps/api/core';

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
    return await invoke('verify_nsec', { nsec });
  },

  parsePubkey: async (pubkey: string): Promise<string> => {
    return await invoke('parse_pubkey', { pubkey });
  },

  generateNsec: async (): Promise<string> => {
    return await invoke('generate_new_nsec');
  },

  fetchEvents: async (
    pubkey: string,
    relays: string[],
    nsec?: string,
    rangeStart?: number,
    rangeEnd?: number,
    authors?: string[]
  ): Promise<NostrEvent[]> => {
    return await invoke('fetch_calendar_events', {
      pubkey,
      nsec,
      relays,
      rangeStart,
      rangeEnd,
      authors,
    });
  },

  publishEvent: async (
    nsec: string,
    relays: string[],
    eventData: CalendarEventRequest
  ): Promise<string> => {
    return await invoke('publish_calendar_event', { nsec, relays, eventData });
  },

  publishBatchEvents: async (
    nsec: string,
    relays: string[],
    events: CalendarEventRequest[]
  ): Promise<string[]> => {
    return await invoke('publish_batch_calendar_events', {
      nsec,
      relays,
      events,
    });
  },

  deleteEvent: async (
    nsec: string,
    relays: string[],
    eventId: string | string[]
  ): Promise<string> => {
    const eventIds = Array.isArray(eventId) ? eventId : [eventId];
    return await invoke('delete_calendar_event', { nsec, relays, eventIds });
  },

  fetchContactList: async (
    pubkey: string,
    relays: string[]
  ): Promise<Contact[]> => {
    return await invoke('fetch_contact_list', { pubkey, relays });
  },

  updateContactList: async (
    nsec: string,
    relays: string[],
    contacts: Contact[]
  ): Promise<string> => {
    return await invoke('update_contact_list', { nsec, relays, contacts });
  },

  fetchProfiles: async (
    pubkeys: string[],
    relays: string[]
  ): Promise<UserProfile[]> => {
    return await invoke('fetch_profiles', { pubkeys, relays });
  },

  sendDirectMessage: async (
    nsec: string,
    receiverPubkey: string,
    message: string,
    relays: string[]
  ): Promise<string> => {
    return await invoke('send_direct_message', {
      nsec,
      receiverPubkey,
      message,
      relays,
    });
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
    return await invoke('fetch_calendars', { pubkey, relays });
  },

  publishCalendar: async (
    nsec: string,
    relays: string[],
    calendar: CalendarRequest
  ): Promise<string> => {
    return await invoke('publish_calendar', { nsec, relays, calendar });
  },

  deleteCalendar: async (
    nsec: string,
    relays: string[],
    identifier: string
  ): Promise<string> => {
    return await invoke('delete_calendar', { nsec, relays, identifier });
  },

  fetchRSVPs: async (
    eventCoordinate: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return await invoke('fetch_rsvps', { eventCoordinate, relays });
  },

  fetchUserRSVPs: async (
    pubkey: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return await invoke('fetch_user_rsvps', { pubkey, relays });
  },

  fetchReceivedRSVPs: async (
    pubkey: string,
    relays: string[]
  ): Promise<NostrEvent[]> => {
    return await invoke('fetch_received_rsvps', { pubkey, relays });
  },

  publishRSVP: async (
    nsec: string,
    relays: string[],
    eventCoordinate: string,
    status: 'accepted' | 'declined' | 'tentative',
    eventAuthor?: string
  ): Promise<string> => {
    return await invoke('publish_rsvp', {
      nsec,
      relays,
      eventCoordinate,
      status,
      eventAuthor,
    });
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
};

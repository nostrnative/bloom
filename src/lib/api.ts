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
  parsePubkey: async (pubkey: string): Promise<string> => {
    return await nostrNative.parsePubkey(pubkey);
  },

  fetchEvents: async (
    pubkey: string,
    relays: string[],
    rangeStart?: number,
    rangeEnd?: number,
    authors?: string[]
  ): Promise<NostrEvent[]> => {
    return (await nostrNative.fetchCalendarEvents(pubkey, relays, {
      rangeStart,
      rangeEnd,
      authors,
    })) as unknown as NostrEvent[];
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

  fetchProfiles: async (
    pubkeys: string[],
    relays: string[]
  ): Promise<UserProfile[]> => {
    return (await nostrNative.fetchProfiles(
      pubkeys,
      relays
    )) as unknown as UserProfile[];
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

  updateSyncSettings: async (settings: {
    local_relay: string | null;
    remote_relays: string[];
    pubkey: string | null;
    interval_minutes: number;
    enabled: boolean;
    only_contacts: boolean;
    last_sync_timestamp: number | null;
    interested_contact_pubkeys: string[];
    relay_allowed_kinds?: number[];
    relay_allowed_pubkeys?: string[];
    relay_allowed_tagged_pubkeys?: string[];
    relay_port?: number;
  }): Promise<void> => {
    return await invoke('update_sync_settings', { settings });
  },


  // Blossom
  blossomMirror: async (
    serverUrl: string,
    authHeader: string,
    url: string
  ): Promise<string> => {
    return await nostrNative.blossomMirror(serverUrl, authHeader, url);
  },

  blossomUpload: async (
    serverUrl: string,
    authHeader: string,
    filePath: string
  ): Promise<string> => {
    return await nostrNative.blossomUpload(serverUrl, authHeader, filePath);
  },

  blossomUploadContent: async (
    serverUrl: string,
    authHeader: string,
    content: string,
    filename?: string,
    mediaType?: string
  ): Promise<string> => {
    return await nostrNative.blossomUploadContent(
      serverUrl,
      authHeader,
      content,
      filename,
      mediaType
    );
  },

  blossomDelete: async (
    serverUrl: string,
    authHeader: string,
    hash: string
  ): Promise<void> => {
    return await nostrNative.blossomDelete(serverUrl, authHeader, hash);
  },

  blossomList: async (
    serverUrl: string,
    pubkey: string,
    authHeader?: string
  ): Promise<any[]> => {
    return await nostrNative.blossomList(serverUrl, pubkey, authHeader);
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
  getRelayEvents: async (): Promise<NostrEvent[]> => {
    return (await nostrNative.getNostrRelayEvents()) as unknown as NostrEvent[];
  },
};

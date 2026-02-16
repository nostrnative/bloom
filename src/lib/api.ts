import { invoke } from '@tauri-apps/api/core';
import * as nostrNative from 'tauri-plugin-nostrnative';

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

export const nostrApi = {
  parsePubkey: async (pubkey: string): Promise<string> => {
    return await nostrNative.parsePubkey(pubkey);
  },

  updateSyncSettings: async (settings: {
    local_relay: string | null;
    remote_relays: string[];
    interval_minutes: number;
    enabled: boolean;
    only_contacts: boolean;
    last_sync_timestamp: number | null;
    interested_contact_pubkeys: string[];
    relay_enabled?: boolean;
    relay_allowed_kinds?: number[];
    relay_allowed_pubkeys?: string[];
    relay_allowed_tagged_pubkeys?: string[];
    relay_enable_search?: boolean;
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
    return (await nostrNative.getNostrEventCounts()) as Record<number, number>;
  },
  getRelayEvents: async (): Promise<NostrEvent[]> => {
    return (await nostrNative.getNostrRelayEvents()) as unknown as NostrEvent[];
  },
};

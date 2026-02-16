import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  pubkey: string | null;
  relays: string[];
  localRelay: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  onlyContacts: boolean;
  lastSyncTimestamp: number | null;
  interestedContactPubkeys: string[];
  blossomPort: number;
  preferredPort: number | null;
  relayEnabled: boolean;
  relayPort: number;
  relayAllowedKinds: number[];
  relayAllowedPubkeys: string[];
  relayAllowedTaggedPubkeys: string[];
  relayEnableSearch: boolean;
  relayHost: string;
  relayAutoBackup: boolean;
  relayAutoBackupFolder: string;
  relayStartOnBoot: boolean;
  relayUseProxy: boolean;
  relayProxyPort: number;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setBlossomPort: (port: number) => void;
  setPreferredPort: (port: number | null) => void;
  setRelayEnabled: (enabled: boolean) => void;
  setRelayPort: (port: number) => void;
  setRelayAllowedKinds: (kinds: number[]) => void;
  setRelayAllowedPubkeys: (pubkeys: string[]) => void;
  setRelayAllowedTaggedPubkeys: (pubkeys: string[]) => void;
  setRelayEnableSearch: (enabled: boolean) => void;
  setRelayHost: (host: string) => void;
  setRelayAutoBackup: (enabled: boolean) => void;
  setRelayAutoBackupFolder: (folder: string) => void;
  setRelayStartOnBoot: (enabled: boolean) => void;
  setRelayUseProxy: (enabled: boolean) => void;
  setRelayProxyPort: (port: number) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, _get) => ({
      theme: 'system',
      pubkey: null,
      relays: [],
      localRelay: null,
      syncEnabled: false,
      syncIntervalMinutes: 5,
      onlyContacts: true,
      lastSyncTimestamp: null,
      interestedContactPubkeys: [],
      blossomPort: 24242,
      preferredPort: null,
      relayEnabled: true,
      relayPort: 4869,
      relayAllowedKinds: [],
      relayAllowedPubkeys: [],
      relayAllowedTaggedPubkeys: [],
      relayEnableSearch: false,
      relayHost: '127.0.0.1',
      relayAutoBackup: false,
      relayAutoBackupFolder: '',
      relayStartOnBoot: true,
      relayUseProxy: false,
      relayProxyPort: 9050,
      setTheme: (theme) => set({ theme }),
      setBlossomPort: (port) => set({ blossomPort: port }),
      setPreferredPort: (port) => set({ preferredPort: port }),
      setRelayEnabled: (enabled) => set({ relayEnabled: enabled }),
      setRelayPort: (relayPort) => set({ relayPort }),
      setRelayAllowedKinds: (relayAllowedKinds) => set({ relayAllowedKinds }),
      setRelayAllowedPubkeys: (relayAllowedPubkeys) =>
        set({ relayAllowedPubkeys }),
      setRelayAllowedTaggedPubkeys: (relayAllowedTaggedPubkeys) =>
        set({ relayAllowedTaggedPubkeys }),
      setRelayEnableSearch: (relayEnableSearch) => set({ relayEnableSearch }),
      setRelayHost: (relayHost) => set({ relayHost }),
      setRelayAutoBackup: (relayAutoBackup) => set({ relayAutoBackup }),
      setRelayAutoBackupFolder: (relayAutoBackupFolder) =>
        set({ relayAutoBackupFolder }),
      setRelayStartOnBoot: (relayStartOnBoot) => set({ relayStartOnBoot }),
      setRelayUseProxy: (relayUseProxy) => set({ relayUseProxy }),
      setRelayProxyPort: (relayProxyPort) => set({ relayProxyPort }),
      logout: () =>
        set({
          pubkey: null,
        }),
    }),
    {
      name: 'calendar-storage',
    }
  )
);

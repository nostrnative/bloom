import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  nsec: string | null;
  pubkey: string | null;
  relays: string[];
  notificationsEnabled: boolean;
  reminderInterval: number;
  selectedCalendarId: string | null;
  theme: "light" | "dark" | "system";
  localRelay: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  onlyContacts: boolean;
  hideDeclinedEvents: boolean;
  useDifferentTimestamp: boolean;
  lastSyncTimestamp: number | null;
  lastNotificationVisit: number;
  selectedContactPubkeys: string[];
  interestedContactPubkeys: string[];
  blossomPort: number;
  preferredPort: number | null;
  relayEnabled: boolean;
  relayPort: number;
  statusFilters: {
    accepted: boolean;
    tentative: boolean;
    declined: boolean;
    self: boolean;
  };
  setCredentials: (nsec: string, pubkey: string) => void;
  setRelays: (relays: string[]) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderInterval: (interval: number) => void;
  setSelectedCalendarId: (id: string | null) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocalRelay: (relay: string | null) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setSyncIntervalMinutes: (interval: number) => void;
  setOnlyContacts: (only: boolean) => void;
  setHideDeclinedEvents: (hide: boolean) => void;
  setUseDifferentTimestamp: (use: boolean) => void;
  setLastSyncTimestamp: (timestamp: number | null) => void;
  setLastNotificationVisit: (timestamp: number) => void;
  setSelectedContactPubkeys: (pubkeys: string[]) => void;
  toggleSelectedContactPubkey: (pubkey: string) => void;
  setInterestedContactPubkeys: (pubkeys: string[]) => void;
  toggleInterestedContactPubkey: (pubkey: string) => void;
  setBlossomPort: (port: number) => void;
  setPreferredPort: (port: number | null) => void;
  setRelayEnabled: (enabled: boolean) => void;
  setRelayPort: (port: number) => void;
  setStatusFilters: (filters: {
    accepted: boolean;
    tentative: boolean;
    declined: boolean;
    self: boolean;
  }) => void;
  getAllRelays: () => string[];
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      nsec: null,
      pubkey: null,
      relays: [
        "wss://relay.damus.io",
        "wss://nos.lol",
        "wss://relay.primal.net",
        "wss://relay.0xchat.com",
      ],
      notificationsEnabled: false,
      reminderInterval: 1,
      selectedCalendarId: null,
      theme: "system",
      localRelay: null,
      syncEnabled: false,
      syncIntervalMinutes: 5,
      onlyContacts: true,
      hideDeclinedEvents: false,
      useDifferentTimestamp: false,
      lastSyncTimestamp: null,
      lastNotificationVisit: 0,
      selectedContactPubkeys: [],
      interestedContactPubkeys: [],
      blossomPort: 24242,
      preferredPort: null,
      relayEnabled: true,
      relayPort: 4870,
      statusFilters: {
        accepted: true,
        tentative: true,
        declined: true,
        self: true,
      },
      setCredentials: (nsec, pubkey) => set({ nsec, pubkey }),
      setRelays: (relays) => set({ relays }),
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
      setReminderInterval: (interval) => set({ reminderInterval: interval }),
      setSelectedCalendarId: (id) => set({ selectedCalendarId: id }),
      setTheme: (theme) => set({ theme }),
      setLocalRelay: (relay) => set({ localRelay: relay }),
      setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
      setSyncIntervalMinutes: (interval) =>
        set({ syncIntervalMinutes: interval }),
      setOnlyContacts: (only) => set({ onlyContacts: only }),
      setHideDeclinedEvents: (hide) => set({ hideDeclinedEvents: hide }),
      setUseDifferentTimestamp: (use) => set({ useDifferentTimestamp: use }),
      setLastSyncTimestamp: (timestamp) =>
        set({ lastSyncTimestamp: timestamp }),
      setLastNotificationVisit: (timestamp) =>
        set({ lastNotificationVisit: timestamp }),
      setSelectedContactPubkeys: (pubkeys) =>
        set({ selectedContactPubkeys: pubkeys }),
      toggleSelectedContactPubkey: (pk) => {
        const { selectedContactPubkeys } = get();
        if (selectedContactPubkeys.includes(pk)) {
          set({
            selectedContactPubkeys: selectedContactPubkeys.filter(
              (k) => k !== pk,
            ),
          });
        } else {
          set({ selectedContactPubkeys: [...selectedContactPubkeys, pk] });
        }
      },
      setInterestedContactPubkeys: (pubkeys) =>
        set({ interestedContactPubkeys: pubkeys }),
      toggleInterestedContactPubkey: (pk) => {
        const { interestedContactPubkeys, selectedContactPubkeys } = get();
        if (interestedContactPubkeys.includes(pk)) {
          set({
            interestedContactPubkeys: interestedContactPubkeys.filter(
              (k) => k !== pk,
            ),
            selectedContactPubkeys: selectedContactPubkeys.filter(
              (k) => k !== pk,
            ),
          });
        } else {
          set({ interestedContactPubkeys: [...interestedContactPubkeys, pk] });
        }
      },
      setBlossomPort: (port) => set({ blossomPort: port }),
      setPreferredPort: (port) => set({ preferredPort: port }),
      setRelayEnabled: (enabled) => set({ relayEnabled: enabled }),
      setRelayPort: (port) => set({ relayPort: port }),
      setStatusFilters: (filters) => set({ statusFilters: filters }),
      getAllRelays: () => {
        const state = get();
        const allRelays = [...state.relays];
        if (state.syncEnabled && state.localRelay) {
          if (!allRelays.includes(state.localRelay)) {
            allRelays.unshift(state.localRelay);
          }
        }
        return allRelays;
      },
      logout: () =>
        set({
          nsec: null,
          pubkey: null,
          selectedCalendarId: null,
          selectedContactPubkeys: [],
          interestedContactPubkeys: [],
        }),
    }),
    {
      name: "calendar-storage",
    },
  ),
);

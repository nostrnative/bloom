import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { nostrApi, UserProfile } from "@/lib/api";
import { useCalendars } from "@/hooks/useCalendars";
import {
  Trash2,
  Plus,
  Bell,
  BellOff,
  RefreshCw,
  User,
  ExternalLink,
  Calendar as CalendarIcon,
  Database,
  Cloud,
  CloudOff,
  Shield,
  ShieldCheck,
} from "lucide-react";

export default function Settings() {
  const {
    nsec,
    pubkey,
    setCredentials,
    relays,
    setRelays,
    logout,
    notificationsEnabled,
    setNotificationsEnabled,
    reminderInterval,
    setReminderInterval,
    selectedCalendarId,
    setSelectedCalendarId,
    theme,
    setTheme,
    localRelay,
    setLocalRelay,
    syncEnabled,
    setSyncEnabled,
    syncIntervalMinutes,
    setSyncIntervalMinutes,
    onlyContacts,
    setOnlyContacts,
    hideDeclinedEvents,
    setHideDeclinedEvents,
    useDifferentTimestamp,
    setUseDifferentTimestamp,
    lastSyncTimestamp,
    getAllRelays,
    interestedContactPubkeys,
    toggleInterestedContactPubkey,
    preferredPort,
    setPreferredPort,
    blossomPort,
  } = useAppStore();
  const { calendars, createCalendar, deleteCalendar } = useCalendars();
  const [inputNsec, setInputNsec] = useState(nsec || "");
  const [newRelay, setNewRelay] = useState("");
  const [inputLocalRelay, setInputLocalRelay] = useState(localRelay || "");
  const [inputPort, setInputPort] = useState(preferredPort?.toString() || "");
  const [newCalName, setNewCalName] = useState("");
  const [newCalDesc, setNewCalDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const queryClient = useQueryClient();

  const handleLocalRelayChange = (value: string) => {
    setInputLocalRelay(value);
    setLocalRelay(value || null);
  };

  const handlePortChange = (value: string) => {
    setInputPort(value);
    const port = parseInt(value);
    if (!isNaN(port) && port > 0 && port < 65536) {
      setPreferredPort(port);
    } else if (value === "") {
      setPreferredPort(null);
    }
  };

  useEffect(() => {
    if (nsec) {
      updateSync();
    }
  }, [
    localRelay,
    relays,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    interestedContactPubkeys,
  ]);

  // React Query for Contacts
  const contactsQuery = useQuery({
    queryKey: ["contacts", pubkey],
    queryFn: () =>
      pubkey ? nostrApi.fetchContactList(pubkey, getAllRelays()) : [],
    enabled: !!pubkey && !!nsec,
  });

  const contacts = contactsQuery.data || [];

  // React Query for Profiles
  const profilesQuery = useQuery({
    queryKey: ["profiles", contacts.map((c) => c.pubkey)],
    queryFn: async () => {
      const pks = contacts.map((c) => c.pubkey);
      if (pks.length === 0) return {};
      const fetchedProfiles = await nostrApi.fetchProfiles(pks, getAllRelays());
      const profileMap: Record<string, UserProfile> = {};
      fetchedProfiles.forEach((p) => {
        profileMap[p.pubkey] = p;
      });
      return profileMap;
    },
    enabled: contacts.length > 0,
  });

  const profiles = profilesQuery.data || {};

  const verifyAndConnect = async (keyToVerify: string) => {
    setLoading(true);
    setError("");
    try {
      const pubkey = await nostrApi.verifyNsec(keyToVerify.trim());
      setCredentials(keyToVerify.trim(), pubkey);
      queryClient.invalidateQueries();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    setLoading(true);
    try {
      const newKey = await nostrApi.generateNsec();
      setInputNsec(newKey);
      await verifyAndConnect(newKey);
    } catch (e: any) {
      setError("Failed to generate keys: " + e.toString());
      setLoading(false);
    }
  };

  const addRelay = () => {
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay("");
    }
  };

  const removeRelay = (relay: string) => {
    setRelays(relays.filter((r) => r !== relay));
  };

  const handleCreateCalendar = async () => {
    if (!newCalName.trim()) return;
    try {
      await createCalendar({
        name: newCalName,
        description: newCalDesc,
        identifier: crypto.randomUUID(),
      });
      setNewCalName("");
      setNewCalDesc("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setError("");
    try {
      await updateSync();
      await nostrApi.triggerSync();
      queryClient.invalidateQueries();
    } catch (e: any) {
      setError("Sync failed: " + e.toString());
    } finally {
      setSyncing(false);
    }
  };

  const updateSync = async () => {
    await nostrApi.updateSyncSettings({
      local_relay: localRelay,
      remote_relays: relays,
      pubkey,
      nsec,
      interval_minutes: syncIntervalMinutes,
      enabled: syncEnabled,
      only_contacts: onlyContacts,
      last_sync_timestamp: lastSyncTimestamp,
      interested_contact_pubkeys: interestedContactPubkeys,
    });
  };

  const handleDeleteCalendar = async (identifier: string) => {
    if (!confirm("Delete this calendar?")) return;
    try {
      await deleteCalendar(identifier);
      if (selectedCalendarId === identifier) {
        setSelectedCalendarId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const requestNotificationPermission = async () => {
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");
    let permission = await isPermissionGranted();
    if (!permission) {
      const permissionStatus = await requestPermission();
      permission = permissionStatus === "granted";
    }
    setNotificationsEnabled(permission);
    if (permission) {
      sendNotification({
        title: "Notifications Enabled",
        body: "You will be notified of important updates.",
      });
    }
  };

  if (nsec) {
    // Logged in View
    return (
      <div className="mx-auto h-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Settings
        </h2>

        <div className="space-y-8">
          {/* Account Section */}
          <section className="space-y-4">
            <h3 className="border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              Account
            </h3>
            <div className="flex flex-col rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">Public Key:</p>
              <code className="truncate text-xs text-zinc-800 dark:text-zinc-200">
                {pubkey}
              </code>
            </div>
            <div className="flex items-end justify-end">
              <button
                onClick={logout}
                className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-200"
              >
                Logout
              </button>
            </div>
          </section>

          {/* Theme Section */}
          <section className="space-y-4">
            <h3 className="border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              Theme
            </h3>
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Appearance</span>
                <span className="text-xs text-zinc-500">
                  Choose your preferred theme
                </span>
              </div>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as "light" | "dark" | "system")
                }
                className="rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </section>

          {/* Blossom Server Section */}
          <section className="space-y-4">
            <h3 className="border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              Blossom Server
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Current Port</span>
                  <span className="text-xs text-zinc-500">
                    Port used by the active server
                  </span>
                </div>
                <Badge className="bg-indigo-600">{blossomPort}</Badge>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Manual Port Override
                </label>
                <input
                  type="number"
                  className="w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Default (24242)"
                  value={inputPort}
                  onChange={(e) => handlePortChange(e.target.value)}
                />
                <p className="text-xs text-zinc-500">
                  Set a specific port to use. Requires app restart to apply to
                  the server.
                </p>
              </div>
            </div>
          </section>

          {/* Relays Section */}
          <section className="space-y-4">
            <h3 className="border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              Relays
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="wss://..."
                value={newRelay}
                onChange={(e) => setNewRelay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRelay()}
              />
              <button
                onClick={addRelay}
                className="rounded-md bg-zinc-900 p-2 text-white hover:bg-zinc-700"
              >
                <Plus size={20} />
              </button>
            </div>

            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {relays.map((relay) => (
                <li
                  key={relay}
                  className="group flex items-center justify-between rounded-md bg-zinc-50 p-3 dark:bg-zinc-900"
                >
                  <span className="truncate text-sm">{relay}</span>
                  <button
                    onClick={() => removeRelay(relay)}
                    className="text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  // Logged Out View
  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Welcome
      </h2>

      <div className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nostr Private Key (nsec)
          </label>
          <input
            type="password"
            value={inputNsec}
            onChange={(e) => setInputNsec(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-transparent p-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700"
            placeholder="nsec1..."
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="space-y-3">
          <button
            onClick={() => verifyAndConnect(inputNsec)}
            disabled={loading || !inputNsec}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-700"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-950">
                Or
              </span>
            </div>
          </div>

          <button
            onClick={handleGenerateKeys}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw size={16} />
            Generate New Identity
          </button>
        </div>
      </div>
    </div>
  );
}

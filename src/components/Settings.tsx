import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { nostrApi, UserProfile } from '@/lib/api';
import { useCalendars } from '@/hooks/useCalendars';
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
} from 'lucide-react';

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
  } = useAppStore();
  const { calendars, createCalendar, deleteCalendar } = useCalendars();
  const [inputNsec, setInputNsec] = useState(nsec || '');
  const [newRelay, setNewRelay] = useState('');
  const [inputLocalRelay, setInputLocalRelay] = useState(localRelay || '');
  const [newCalName, setNewCalName] = useState('');
  const [newCalDesc, setNewCalDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const queryClient = useQueryClient();

  const handleLocalRelayChange = (value: string) => {
    setInputLocalRelay(value);
    setLocalRelay(value || null);
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
    queryKey: ['contacts', pubkey],
    queryFn: () =>
      pubkey ? nostrApi.fetchContactList(pubkey, getAllRelays()) : [],
    enabled: !!pubkey && !!nsec,
  });

  const contacts = contactsQuery.data || [];

  // React Query for Profiles
  const profilesQuery = useQuery({
    queryKey: ['profiles', contacts.map((c) => c.pubkey)],
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
    setError('');
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
      setError('Failed to generate keys: ' + e.toString());
      setLoading(false);
    }
  };

  const addRelay = () => {
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay('');
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
      setNewCalName('');
      setNewCalDesc('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setError('');
    try {
      await updateSync();
      await nostrApi.triggerSync();
      queryClient.invalidateQueries();
    } catch (e: any) {
      setError('Sync failed: ' + e.toString());
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
    if (!confirm('Delete this calendar?')) return;
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
      await import('@tauri-apps/plugin-notification');
    let permission = await isPermissionGranted();
    if (!permission) {
      const permissionStatus = await requestPermission();
      permission = permissionStatus === 'granted';
    }
    setNotificationsEnabled(permission);
    if (permission) {
      sendNotification({
        title: 'Notifications Enabled',
        body: 'You will be notified of important updates.',
      });
    }
  };

  if (nsec) {
    // Logged in View
    return (
      <div className='mx-auto h-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950'>
        <h2 className='mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
          Settings
        </h2>

        <div className='space-y-8'>
          {/* Account Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Account
            </h3>
            <div className='flex flex-col rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900'>
              <p className='text-sm text-zinc-500'>Public Key:</p>
              <code className='truncate text-xs text-zinc-800 dark:text-zinc-200'>
                {pubkey}
              </code>
            </div>
            <div className='flex items-end justify-end'>
              <button
                onClick={logout}
                className='rounded-md bg-red-100 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-200'
              >
                Logout
              </button>
            </div>
          </section>

          {/* Theme Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Theme
            </h3>
            <div className='flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900'>
              <div className='flex flex-col'>
                <span className='text-sm font-medium'>Appearance</span>
                <span className='text-xs text-zinc-500'>
                  Choose your preferred theme
                </span>
              </div>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as 'light' | 'dark' | 'system')
                }
                className='rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950'
              >
                <option value='system'>System</option>
                <option value='light'>Light</option>
                <option value='dark'>Dark</option>
              </select>
            </div>
          </section>

          {/* Security & Privacy Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Security & Privacy
            </h3>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                {onlyContacts ? (
                  <ShieldCheck className='text-green-600' />
                ) : (
                  <Shield className='text-zinc-400' />
                )}
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>
                    Filter by Contacts
                  </span>
                  <span className='text-xs text-zinc-500'>
                    Only show events from people in your contact list
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOnlyContacts(!onlyContacts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${onlyContacts ? 'bg-indigo-600' : 'bg-zinc-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${onlyContacts ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <BellOff className='text-zinc-400' />
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>
                    Hide Declined Events
                  </span>
                  <span className='text-xs text-zinc-500'>
                    Globally hide events you have declined
                  </span>
                </div>
              </div>
              <button
                onClick={() => setHideDeclinedEvents(!hideDeclinedEvents)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hideDeclinedEvents ? 'bg-indigo-600' : 'bg-zinc-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hideDeclinedEvents ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div className='flex items-start justify-between'>
              <div className='flex items-center gap-3'>
                <RefreshCw className='mt-1 text-zinc-400' />
                <div className='flex flex-col pr-4'>
                  <span className='text-sm font-medium'>
                    Efficient Event Filtering
                  </span>
                  <span className='text-xs text-zinc-500'>
                    Store events using their start time as the publication date.
                    This allows relays to filter events efficiently without
                    downloading everything.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setUseDifferentTimestamp(!useDifferentTimestamp)}
                className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${useDifferentTimestamp ? 'bg-indigo-600' : 'bg-zinc-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useDifferentTimestamp ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </section>

          {/* Notifications Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Notifications
            </h3>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                {notificationsEnabled ? (
                  <Bell className='text-indigo-600' />
                ) : (
                  <BellOff className='text-zinc-400' />
                )}
                <span>Enable Notifications</span>
              </div>
              <button
                onClick={() => {
                  if (!notificationsEnabled) requestNotificationPermission();
                  else setNotificationsEnabled(false);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-indigo-600' : 'bg-zinc-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {notificationsEnabled && (
              <div className='flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900'>
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>Check Interval</span>
                  <span className='text-xs text-zinc-500'>
                    How often to check for reminders (minutes)
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <input
                    type='number'
                    min='1'
                    max='60'
                    value={reminderInterval}
                    onChange={(e) =>
                      setReminderInterval(parseInt(e.target.value) || 1)
                    }
                    className='w-16 rounded-md border border-zinc-200 p-1 text-center dark:border-zinc-800 dark:bg-zinc-950'
                  />
                  <span className='text-sm text-zinc-500'>min</span>
                </div>
              </div>
            )}
          </section>

          {/* Sync Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Event Sync (Local-First)
            </h3>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                {syncEnabled ? (
                  <Database className='text-indigo-600' />
                ) : (
                  <CloudOff className='text-zinc-400' />
                )}
                <span>Enable Background Sync</span>
              </div>
              <button
                onClick={() => setSyncEnabled(!syncEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${syncEnabled ? 'bg-indigo-600' : 'bg-zinc-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${syncEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {syncEnabled && (
              <>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Local Relay URL</label>
                  <input
                    type='text'
                    className='w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900'
                    placeholder='wss://localhost:8080'
                    value={inputLocalRelay}
                    onChange={(e) => handleLocalRelayChange(e.target.value)}
                  />
                  <p className='text-xs text-zinc-500'>
                    Your local relay for offline-first calendar events
                  </p>
                </div>

                <div className='flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900'>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>Sync Interval</span>
                    <span className='text-xs text-zinc-500'>
                      Minutes between automatic syncs
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <input
                      type='number'
                      min='1'
                      max='60'
                      value={syncIntervalMinutes}
                      onChange={(e) =>
                        setSyncIntervalMinutes(parseInt(e.target.value) || 1)
                      }
                      className='w-16 rounded-md border border-zinc-200 p-1 text-center dark:border-zinc-800 dark:bg-zinc-950'
                    />
                    <span className='text-sm text-zinc-500'>min</span>
                  </div>
                </div>

                <div className='rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30'>
                  <div className='flex items-start gap-2'>
                    <Cloud className='mt-0.5 h-4 w-4 text-indigo-600' />
                    <div className='flex-1'>
                      <p className='text-xs font-medium text-indigo-900 dark:text-indigo-200'>
                        How it works
                      </p>
                      <p className='mt-1 text-xs text-indigo-700 dark:text-indigo-300'>
                        Events sync bidirectionally between your local relay and
                        remote relays. Only new or modified events are synced
                        for efficiency.
                      </p>
                      {lastSyncTimestamp && (
                        <p className='mt-2 text-[10px] text-indigo-600 dark:text-indigo-400'>
                          Last Synced:{' '}
                          {new Date(lastSyncTimestamp * 1000).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className='mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50'
                >
                  <RefreshCw
                    className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
                  />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </>
            )}
          </section>

          {/* Relays Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Relays
            </h3>
            <div className='flex gap-2'>
              <input
                type='text'
                className='flex-1 rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900'
                placeholder='wss://...'
                value={newRelay}
                onChange={(e) => setNewRelay(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRelay()}
              />
              <button
                onClick={addRelay}
                className='rounded-md bg-zinc-900 p-2 text-white hover:bg-zinc-700'
              >
                <Plus size={20} />
              </button>
            </div>

            <ul className='max-h-60 space-y-2 overflow-y-auto'>
              {relays.map((relay) => (
                <li
                  key={relay}
                  className='group flex items-center justify-between rounded-md bg-zinc-50 p-3 dark:bg-zinc-900'
                >
                  <span className='truncate text-sm'>{relay}</span>
                  <button
                    onClick={() => removeRelay(relay)}
                    className='text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500'
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Calendars Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Manage Calendars
            </h3>
            <div className='space-y-3'>
              <div className='flex flex-col gap-2'>
                <input
                  type='text'
                  className='rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900'
                  placeholder='Calendar Name'
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                />
                <div className='flex gap-2'>
                  <input
                    type='text'
                    className='flex-1 rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900'
                    placeholder='Description (optional)'
                    value={newCalDesc}
                    onChange={(e) => setNewCalDesc(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && newCalName && handleCreateCalendar()
                    }
                  />
                  <button
                    onClick={handleCreateCalendar}
                    disabled={!newCalName.trim()}
                    className='rounded-md bg-zinc-900 p-2 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200'
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <ul className='space-y-2'>
                <li
                  className={`flex items-center justify-between rounded-md p-3 ${
                    selectedCalendarId === null
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                      : 'bg-zinc-50 dark:bg-zinc-900'
                  }`}
                  onClick={() => setSelectedCalendarId(null)}
                >
                  <div className='flex cursor-pointer items-center gap-2'>
                    <CalendarIcon size={16} />
                    <span className='text-sm font-medium'>
                      All Events (Default)
                    </span>
                  </div>
                </li>
                {calendars.map((cal) => (
                  <li
                    key={cal.identifier}
                    className={`group flex cursor-pointer items-center justify-between rounded-md p-3 ${
                      selectedCalendarId === cal.identifier
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
                        : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                    }`}
                    onClick={() => setSelectedCalendarId(cal.identifier)}
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <div className='h-2 w-2 rounded-full bg-indigo-500' />
                        <span className='truncate text-sm font-medium'>
                          {cal.name}
                        </span>
                      </div>
                      {cal.description && (
                        <p className='mt-0.5 truncate text-xs text-zinc-500'>
                          {cal.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCalendar(cal.identifier);
                      }}
                      className='text-red-500 transition-opacity'
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Contacts Section */}
          <section className='space-y-4'>
            <h3 className='border-b pb-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300'>
              Contacts
            </h3>
            <input
              type='text'
              className='w-full rounded-md border p-2 dark:border-zinc-700 dark:bg-zinc-900'
              placeholder='Search contacts...'
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            {contactsQuery.isLoading && contacts.length === 0 ? (
              <p className='py-4 text-center text-sm text-zinc-500'>
                Loading contacts...
              </p>
            ) : contacts.length === 0 ? (
              <p className='py-4 text-center text-sm text-zinc-500'>
                No contacts found on your Nostr profile.
              </p>
            ) : (
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {contacts.map((contact) => {
                  const profile = profiles[contact.pubkey];
                  const name =
                    profile?.display_name ||
                    profile?.name ||
                    contact.alias ||
                    'Unknown';
                  const searchTerm = contactSearch.toLowerCase();
                  const isInterested = interestedContactPubkeys.includes(
                    contact.pubkey
                  );
                  if (
                    !name.toLowerCase().includes(searchTerm) &&
                    !contact.pubkey.toLowerCase().includes(searchTerm)
                  ) {
                    return null;
                  }
                  return (
                    <div
                      key={contact.pubkey}
                      className='flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50'
                    >
                      <button
                        onClick={() =>
                          toggleInterestedContactPubkey(contact.pubkey)
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          isInterested
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                        }`}
                      >
                        {isInterested && (
                          <div className='h-2 w-2 rounded-full bg-white' />
                        )}
                      </button>
                      <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800'>
                        {profile?.picture ? (
                          <img
                            src={profile.picture}
                            alt={name}
                            className='h-full w-full object-cover'
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        ) : (
                          <User className='h-5 w-5 text-zinc-400' />
                        )}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate font-medium text-zinc-900 dark:text-zinc-100'>
                          {name}
                        </div>
                        <div className='flex items-center gap-1 truncate text-xs text-zinc-500'>
                          <span className='truncate'>{contact.pubkey}</span>
                          <a
                            href={`https://njump.me/${contact.pubkey}`}
                            target='_blank'
                            rel='noreferrer'
                            className='text-indigo-500 hover:text-indigo-600'
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // Logged Out View
  return (
    <div className='mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950'>
      <h2 className='mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
        Welcome
      </h2>

      <div className='space-y-6'>
        <div>
          <label className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            Nostr Private Key (nsec)
          </label>
          <input
            type='password'
            value={inputNsec}
            onChange={(e) => setInputNsec(e.target.value)}
            className='w-full rounded-md border border-zinc-300 bg-transparent p-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700'
            placeholder='nsec1...'
          />
        </div>

        {error && <p className='text-sm text-red-500'>{error}</p>}

        <div className='space-y-3'>
          <button
            onClick={() => verifyAndConnect(inputNsec)}
            disabled={loading || !inputNsec}
            className='w-full rounded-md bg-zinc-900 px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900'
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-zinc-200 dark:border-zinc-700'></span>
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-white px-2 text-zinc-500 dark:bg-zinc-950'>
                Or
              </span>
            </div>
          </div>

          <button
            onClick={handleGenerateKeys}
            disabled={loading}
            className='flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900'
          >
            <RefreshCw size={16} />
            Generate New Identity
          </button>
        </div>
      </div>
    </div>
  );
}

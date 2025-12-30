import { useState, useEffect } from 'react';
import { Search, User, Check } from 'lucide-react';
import { nostrApi, Contact, UserProfile } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ContactSelectorProps {
  onSelect: (pubkeys: string[]) => void;
  selectedPubkeys: string[];
  multiple?: boolean;
  pubkeyFilter?: string[];
}

export default function ContactSelector({
  onSelect,
  selectedPubkeys,
  multiple = false,
  pubkeyFilter,
}: ContactSelectorProps) {
  const { pubkey, relays } = useAppStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (pubkey && relays.length > 0) {
      const fetchContacts = async () => {
        setLoading(true);
        const fetchedContacts = await nostrApi.fetchContactList(pubkey, relays);
        setContacts(fetchedContacts);
        // Fetch profiles for these contacts
        const pks = fetchedContacts.map((c) => c.pubkey);
        if (pks.length > 0) {
          const fetchedProfiles = await nostrApi.fetchProfiles(pks, relays);
          const profileMap: Record<string, UserProfile> = {};
          fetchedProfiles.forEach((p) => {
            profileMap[p.pubkey] = p;
          });
          setProfiles(profileMap);
        }
        setLoading(false);
      };
      fetchContacts();
    }
  }, [pubkey, relays]);

  const toggleSelection = (pk: string) => {
    if (multiple) {
      if (selectedPubkeys.includes(pk)) {
        onSelect(selectedPubkeys.filter((k) => k !== pk));
      } else {
        onSelect([...selectedPubkeys, pk]);
      }
    } else {
      onSelect([pk]);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (pubkeyFilter && !pubkeyFilter.includes(c.pubkey)) return false;
    // simple search
    if (!search) return true;
    const term = search.toLowerCase();
    const profile = profiles[c.pubkey];
    return (
      (c.alias && c.alias.toLowerCase().includes(term)) ||
      (profile?.name && profile.name.toLowerCase().includes(term)) ||
      (profile?.display_name &&
        profile.display_name.toLowerCase().includes(term)) ||
      c.pubkey.includes(term)
    );
  });

  const isNpubOrHex = (s: string) => {
    // Basic heuristic
    const lower = s.toLowerCase();
    if (lower.startsWith('npub1') && s.length > 50) return true;
    if (/^[0-9a-f]{64}$/.test(lower)) return true;
    return false;
  };

  const showManualOption = search && isNpubOrHex(search);

  const handleManualEntry = async () => {
    if (!search) return;
    const hex = search.startsWith('npub')
      ? await nostrApi.parsePubkey(search)
      : search;
    toggleSelection(hex);
    // Add to local contact list implicitly for UI consistency if not exists
    if (!contacts.some((c) => c.pubkey === hex)) {
      const newContact: Contact = { pubkey: hex, alias: null };
      setContacts((prev) => [...prev, newContact]);
      // Fetch profile in detached way
      const fetchDetachedProfiles = async () => {
        const fetchedProfiles = await nostrApi.fetchProfiles([hex], relays);
        if (fetchedProfiles.length > 0) {
          setProfiles((prev) => ({ ...prev, [hex]: fetchedProfiles[0] }));
        }
      };
      fetchDetachedProfiles();
    }
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='relative'>
        <Search className='absolute top-2.5 left-3 h-4 w-4 text-zinc-400' />
        <input
          type='text'
          placeholder='Search contacts or enter npub...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='w-full rounded-lg border border-zinc-200 py-2 pr-4 pl-9 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
        />
      </div>

      <div className='max-h-[120px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50'>
        {showManualOption && (
          <button
            onClick={handleManualEntry}
            type='button'
            className={cn(
              'mb-2 flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
              selectedPubkeys.includes(search) ||
                (search.length === 64 && selectedPubkeys.includes(search))
                ? 'border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30'
                : 'border border-dashed border-transparent border-zinc-300 hover:bg-white dark:border-zinc-600 dark:hover:bg-zinc-700/50'
            )}
          >
            <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50'>
              <User className='h-4 w-4 text-indigo-600 dark:text-indigo-300' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='truncate font-medium text-zinc-900 dark:text-zinc-100'>
                Use entered Pubkey
              </div>
              <div className='truncate text-xs text-zinc-500'>
                {search.length > 20
                  ? search.substring(0, 12) +
                    '...' +
                    search.substring(search.length - 8)
                  : search}
              </div>
            </div>
            {selectedPubkeys.includes(search) && (
              <Check className='h-4 w-4 text-indigo-600' />
            )}
          </button>
        )}

        {loading && (
          <div className='p-4 text-center text-zinc-500'>
            Loading contacts...
          </div>
        )}

        {!loading && filteredContacts.length === 0 && !showManualOption && (
          <div className='p-4 text-center text-zinc-500'>
            No subscribers found
          </div>
        )}

        {filteredContacts
          .filter((c) => c.pubkey !== pubkey)
          .map((contact) => {
            const profile = profiles[contact.pubkey];
            const name =
              profile?.display_name ||
              profile?.name ||
              contact.alias ||
              contact.pubkey.substring(0, 8) +
                '...' +
                contact.pubkey.substring(56);

            const isSelected = selectedPubkeys.includes(contact.pubkey);
            const showPubkey =
              profile?.display_name || profile?.name || contact.alias;

            return (
              <button
                key={contact.pubkey}
                onClick={() => toggleSelection(contact.pubkey)}
                type='button'
                className={cn(
                  'mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                  isSelected
                    ? 'border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30'
                    : 'border border-transparent hover:bg-white dark:hover:bg-zinc-700/50'
                )}
              >
                <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-600'>
                  {profile?.picture ? (
                    <img
                      src={profile.picture}
                      alt={name}
                      className='h-full w-full object-cover'
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  {(!profile?.picture ||
                    (profile?.picture &&
                      profiles[contact.pubkey]?.picture === '')) && (
                    <User className='h-4 w-4 text-zinc-500 dark:text-zinc-300' />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='truncate font-medium text-zinc-900 dark:text-zinc-100'>
                    {name}
                  </div>
                  {showPubkey && (
                    <div className='truncate text-xs text-zinc-500'>
                      {contact.pubkey.substring(0, 12)}...
                      {contact.pubkey.substring(52)}
                    </div>
                  )}
                </div>
                {isSelected && <Check className='h-4 w-4 text-indigo-600' />}
              </button>
            );
          })}
      </div>
    </div>
  );
}

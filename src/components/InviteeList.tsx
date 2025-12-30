import { ParsedRSVP } from '@/lib/nostr-utils';
import { UserProfile } from '@/lib/api';
import { cn } from '@/lib/utils';
import { User, Check, X, HelpCircle, Clock } from 'lucide-react';

interface InviteeListProps {
  invitees: string[];
  rsvps: ParsedRSVP[];
  inviteeProfiles: Record<string, UserProfile>;
  className?: string;
}

export default function InviteeList({
  invitees,
  rsvps,
  inviteeProfiles,
  className,
}: InviteeListProps) {
  if (invitees.length === 0) return null;

  return (
    <div
      className={cn(
        'max-h-48 overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-900/50',
        className
      )}
    >
      {invitees.map((pk) => {
        const rsvp = rsvps.find((r) => r.pubkey === pk);
        const profile = inviteeProfiles[pk];
        const name =
          profile?.display_name ||
          profile?.name ||
          pk.substring(0, 8) + '...' + pk.substring(56);

        return (
          <div key={pk} className='flex items-center justify-between py-1.5'>
            <div className='flex min-w-0 items-center gap-2'>
              <div className='h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800'>
                {profile?.picture ? (
                  <img
                    src={profile.picture}
                    alt={name}
                    className='h-full w-full object-cover'
                  />
                ) : (
                  <User className='m-1.5 h-3 w-3 text-zinc-500' />
                )}
              </div>
              <span className='truncate text-sm font-medium dark:text-zinc-200'>
                {name}
              </span>
            </div>
            <div className='ml-2 flex-shrink-0'>
              {rsvp ? (
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                    rsvp.status === 'accepted' &&
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    rsvp.status === 'declined' &&
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    rsvp.status === 'tentative' &&
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  )}
                >
                  {rsvp.status === 'accepted' && (
                    <Check className='h-2.5 w-2.5' />
                  )}
                  {rsvp.status === 'declined' && <X className='h-2.5 w-2.5' />}
                  {rsvp.status === 'tentative' && (
                    <HelpCircle className='h-2.5 w-2.5' />
                  )}
                  {rsvp.status}
                </div>
              ) : (
                <div className='flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-500'>
                  <Clock className='h-2.5 w-2.5' />
                  pending
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

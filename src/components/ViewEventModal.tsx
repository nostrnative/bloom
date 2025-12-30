import { format } from 'date-fns';
import { MapPin, Bell, Repeat } from 'lucide-react';
import { ParsedEvent } from '@/lib/nostr-utils';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { nostrApi, UserProfile } from '@/lib/api';
import InviteeList from './InviteeList';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRSVPs } from '@/hooks/useRSVPs';
import { Button } from '@/components/ui/button';

interface ViewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ParsedEvent;
  isCreator?: boolean;
}

export default function ViewEventModal({
  isOpen,
  onClose,
  event,
  isCreator = false,
}: ViewEventModalProps) {
  const { getAllRelays } = useAppStore();
  const [inviteeProfiles, setInviteeProfiles] = useState<
    Record<string, UserProfile>
  >({});

  const eventCoordinate =
    event.kind === 31922 || event.kind === 31923
      ? `${event.kind}:${event.pubkey}:${event.identifier}`
      : event.id;

  const { myRSVP, publishRSVP, rsvps, isPublishing } = useRSVPs(
    eventCoordinate,
    event.pubkey
  );

  // Fetch profiles for invitees
  useEffect(() => {
    if (isOpen && event.invitees && event.invitees.length > 0) {
      const fetchInvitees = async () => {
        const relays = getAllRelays();
        const fetched = await nostrApi.fetchProfiles(event.invitees, relays);
        const map: Record<string, UserProfile> = {};
        fetched.forEach((p) => (map[p.pubkey] = p));
        setInviteeProfiles((prev) => ({ ...prev, ...map }));
      };
      fetchInvitees();
    }
  }, [isOpen, event, getAllRelays]);

  const startDate = new Date(event.start * 1000);
  const endDate = event.end ? new Date(event.end * 1000) : null;

  const formatReminder = (minutes: number | undefined) => {
    if (!minutes || minutes === 0) return 'None';
    if (minutes < 60) return `${minutes} min before`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hour(s) before`;
    return `${Math.floor(minutes / 1440)} day(s) before`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-h-[90vh] w-full overflow-x-hidden overflow-y-auto sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Event Invitation</DialogTitle>
        </DialogHeader>

        <div className='grid gap-4 py-4'>
          <div className='grid gap-2'>
            <Label>Title</Label>
            <div className='flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-lg font-medium dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'>
              <span className='flex-1'>{event.title}</span>
              {event.parent && (
                <Repeat className='h-5 w-5 text-indigo-600 opacity-70' />
              )}
            </div>
          </div>

          {event.location && (
            <div className='grid gap-2'>
              <Label className='flex items-center gap-2'>
                <MapPin className='h-4 w-4 text-zinc-500' />
                Location
              </Label>
              <div className='rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'>
                {event.location}
              </div>
            </div>
          )}

          {event.description && (
            <div className='grid gap-2'>
              <Label>Description</Label>
              <div className='rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'>
                {event.description}
              </div>
            </div>
          )}

          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label>Start</Label>
              <div className='rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'>
                <div className='font-medium'>
                  {format(startDate, 'MMM d, yyyy')}
                </div>
                {!event.isAllDay && (
                  <div className='text-sm text-zinc-500 dark:text-zinc-400'>
                    {format(startDate, 'h:mm a')}
                  </div>
                )}
              </div>
            </div>
            <div className='grid gap-2'>
              <Label>End</Label>
              <div className='rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'>
                <div className='font-medium'>
                  {endDate ? format(endDate, 'MMM d, yyyy') : 'Same day'}
                </div>
                {endDate && !event.isAllDay && (
                  <div className='text-sm text-zinc-500 dark:text-zinc-400'>
                    {format(endDate, 'h:mm a')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label className='flex items-center gap-2'>
                <Bell className='h-4 w-4 text-zinc-500' />
                Reminder
              </Label>
              <div className='rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'>
                {formatReminder(event.reminderMinutes)}
              </div>
            </div>
          </div>

          {event.invitees && event.invitees.length > 0 && (
            <div className='grid gap-2'>
              <Label>Guests</Label>
              <div className='flex justify-end gap-2 text-sm'>
                <div className='rounded-full bg-green-100 px-3 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                  Accepted:{' '}
                  {rsvps.filter((r) => r.status === 'accepted').length}
                </div>
                <div className='rounded-full bg-red-100 px-3 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                  Declined:{' '}
                  {rsvps.filter((r) => r.status === 'declined').length}
                </div>
                <div className='rounded-full bg-yellow-100 px-3 py-1 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'>
                  Tentative:{' '}
                  {rsvps.filter((r) => r.status === 'tentative').length}
                </div>
              </div>
              {isCreator && (
                <InviteeList
                  invitees={event.invitees}
                  rsvps={rsvps}
                  inviteeProfiles={inviteeProfiles}
                  className='mt-2'
                />
              )}
            </div>
          )}

          {!isCreator && (
            <div className='grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800'>
              <div className='flex flex-wrap justify-end gap-2'>
                <Button
                  size='sm'
                  type='button'
                  variant={
                    myRSVP?.status === 'accepted' ? 'default' : 'outline'
                  }
                  disabled={isPublishing}
                  className={
                    myRSVP?.status === 'accepted'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : ''
                  }
                  onClick={async () => await publishRSVP('accepted')}
                >
                  {isPublishing && myRSVP?.status !== 'accepted'
                    ? 'Loading...'
                    : 'Accept'}
                </Button>
                <Button
                  size='sm'
                  type='button'
                  variant={
                    myRSVP?.status === 'declined' ? 'default' : 'outline'
                  }
                  disabled={isPublishing}
                  className={
                    myRSVP?.status === 'declined'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : ''
                  }
                  onClick={async () => await publishRSVP('declined')}
                >
                  {isPublishing && myRSVP?.status !== 'declined'
                    ? 'Loading...'
                    : 'Decline'}
                </Button>
                <Button
                  size='sm'
                  type='button'
                  variant={
                    myRSVP?.status === 'tentative' ? 'default' : 'outline'
                  }
                  disabled={isPublishing}
                  className={
                    myRSVP?.status === 'tentative'
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : ''
                  }
                  onClick={async () => await publishRSVP('tentative')}
                >
                  {isPublishing && myRSVP?.status !== 'tentative'
                    ? 'Loading...'
                    : 'Tentative'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

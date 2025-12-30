import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Calendar as CalendarIcon,
  User,
} from 'lucide-react';
import { useNotifications, NotificationItem } from '@/hooks/useNotifications';
import { useAppStore } from '@/lib/store';
import { nostrApi, UserProfile } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import ViewEventModal from '../ViewEventModal';

export default function NotificationsView() {
  const { notifications, isLoading, markAllAsRead } = useNotifications();
  const { getAllRelays } = useAppStore();
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);

  // Mark as read on mount
  useEffect(() => {
    markAllAsRead();
  }, [notifications.length]);

  // Fetch profiles for responders
  const pubkeys = notifications.map((n) => n.pubkey);
  const profilesQuery = useQuery({
    queryKey: ['profiles', pubkeys],
    queryFn: async () => {
      if (pubkeys.length === 0) return {};
      const uniquePubkeys = Array.from(new Set(pubkeys));
      const fetched = await nostrApi.fetchProfiles(
        uniquePubkeys,
        getAllRelays()
      );
      const map: Record<string, UserProfile> = {};
      fetched.forEach((p) => (map[p.pubkey] = p));
      return map;
    },
    enabled: pubkeys.length > 0,
  });

  const profiles = profilesQuery.data || {};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className='h-5 w-5 text-green-500' />;
      case 'declined':
        return <XCircle className='h-5 w-5 text-red-500' />;
      case 'tentative':
        return <HelpCircle className='h-5 w-5 text-orange-500' />;
      default:
        return <CalendarIcon className='h-5 w-5 text-gray-500' />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentative':
        return 'maybe attending';
      default:
        return 'responded to';
    }
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center text-zinc-500'>
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-4 text-zinc-500'>
        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900'>
          <CalendarIcon className='h-8 w-8 opacity-50' />
        </div>
        <p>No notifications yet</p>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-y-auto bg-white dark:bg-zinc-950'>
      <div className='mx-auto max-w-3xl p-4 md:p-6 lg:p-8'>
        <h2 className='mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
          Notifications
        </h2>

        <div className='space-y-4'>
          {notifications.map((item) => {
            const profile = profiles[item.pubkey];
            const name =
              profile?.display_name || profile?.name || item.pubkey.slice(0, 8);
            const eventTitle =
              item.event?.title ||
              item.event?.description?.slice(0, 50) ||
              'Unknown Event';

            return (
              <div
                key={item.id}
                onClick={() => item.event && setSelectedNotification(item)}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
                  item.event
                    ? 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                    : 'cursor-default border-zinc-100 bg-zinc-50 opacity-70 dark:border-zinc-900 dark:bg-zinc-900/50'
                } `}
              >
                <div className='flex-shrink-0'>
                  {profile?.picture ? (
                    <img
                      src={profile.picture}
                      alt={name}
                      className='h-10 w-10 rounded-full border border-zinc-200 object-cover dark:border-zinc-700'
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (
                          e.target as HTMLImageElement
                        ).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 ${profile?.picture ? 'hidden' : ''}`}
                  >
                    <User className='h-5 w-5 text-zinc-400' />
                  </div>
                </div>

                <div className='min-w-0 flex-1'>
                  <div className='mb-1 flex items-center gap-2'>
                    <span className='truncate font-semibold text-zinc-900 dark:text-zinc-100'>
                      {name}
                    </span>
                    <span className='text-sm text-zinc-500'>
                      {getStatusText(item.status)}
                    </span>
                  </div>

                  <div className='flex items-center gap-2 text-zinc-700 dark:text-zinc-300'>
                    {getStatusIcon(item.status)}
                    <span className='truncate font-medium'>{eventTitle}</span>
                  </div>

                  <div className='mt-2 text-xs text-zinc-400'>
                    {formatDistanceToNow(item.createdAt * 1000, {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedNotification?.event && (
        <ViewEventModal
          isOpen={!!selectedNotification}
          onClose={() => setSelectedNotification(null)}
          event={selectedNotification.event}
          isCreator={true}
        />
      )}
    </div>
  );
}

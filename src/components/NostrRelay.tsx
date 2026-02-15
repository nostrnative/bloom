import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Radio,
  Database as DatabaseIcon,
  Activity,
  Clock,
  User,
  Search,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { nostrApi, NostrEvent } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function NostrRelay() {
  const { relayPort } = useAppStore();
  const [relayRunning, setRelayRunning] = useState(false);
  const [eventCounts, setEventCounts] = useState<Record<number, number>>({});
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [selectedKind, setSelectedKind] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>(
    {}
  );

  const checkRelayStatus = async () => {
    try {
      const status = await nostrApi.getRelayStatus();
      setRelayRunning(status);

      if (status) {
        const [counts, allEvents] = await Promise.all([
          nostrApi.getRelayEventCounts(),
          nostrApi.getRelayEvents(),
        ]);
        setEventCounts(counts);
        setEvents(allEvents.sort((a, b) => b.created_at - a.created_at));
      } else {
        setEventCounts({});
        setEvents([]);
      }
    } catch (error) {
      console.error('Failed to check relay status:', error);
      setRelayRunning(false);
      setEventCounts({});
      setEvents([]);
    }
  };

  useEffect(() => {
    checkRelayStatus();
    const interval = setInterval(checkRelayStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesKind = selectedKind === null || e.kind === selectedKind;
      const matchesSearch =
        searchQuery === '' ||
        e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.pubkey.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesKind && matchesSearch;
    });
  }, [events, selectedKind, searchQuery]);

  const toggleEventExpansion = (id: string) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='rounded-2xl bg-orange-100 p-3 dark:bg-orange-900/20'>
            <Radio className='h-8 w-8 text-orange-600 dark:text-orange-400' />
          </div>
          <div>
            <h1 className='text-3xl font-bold'>Nostr Relay</h1>
            <p className='text-muted-foreground'>
              relay for local event storage
            </p>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          <Badge
            variant={relayRunning ? 'default' : 'destructive'}
            className={relayRunning ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <Activity className='mr-1 h-3 w-3' />
            {relayRunning ? 'Online' : 'Offline'}
          </Badge>
          <Badge variant='outline'>Port {relayPort}</Badge>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader className='text-muted-foreground pb-2 text-sm font-medium tracking-wider uppercase'>
            Connection URL
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between'>
              <code className='text-lg font-bold text-orange-600 dark:text-orange-400'>
                ws://localhost:{relayPort}
              </code>
              <Button
                variant='ghost'
                size='sm'
                onClick={() =>
                  navigator.clipboard.writeText(`ws://localhost:${relayPort}`)
                }
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className='border-2 border-dashed'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-sm opacity-70'>
            <DatabaseIcon className='h-4 w-4' />
            Stored Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <p className='text-muted-foreground font-mono text-xs'>
              Backend: LMDB (High Performance)
              <br />
              Mode: Parallel Service
            </p>

            {Object.keys(eventCounts).length > 0 ? (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
                  Click a Kind to View Events
                </p>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>
                  {Object.entries(eventCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([kind, count]) => (
                      <button
                        key={kind}
                        onClick={() => setSelectedKind(Number(kind))}
                        className='flex items-center justify-between rounded border bg-zinc-100 p-2 text-left transition-colors hover:bg-zinc-200 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50'
                      >
                        <span className='font-mono text-xs font-bold'>
                          Kind {kind}
                        </span>
                        <Badge
                          variant='secondary'
                          className='min-w-[2rem] justify-center px-1.5 py-0 text-[10px]'
                        >
                          {count}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              relayRunning && (
                <p className='text-muted-foreground text-xs italic'>
                  No events stored in the local relay yet.
                </p>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={selectedKind !== null}
        onOpenChange={(open) => !open && setSelectedKind(null)}
      >
        <DialogContent className='flex max-h-[80vh] max-w-3xl flex-col p-0'>
          <DialogHeader className='p-6 pb-2'>
            <DialogTitle className='flex items-center justify-between'>
              <span>Events (Kind {selectedKind})</span>
              <Badge variant='secondary'>{filteredEvents.length} total</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className='px-6 pb-4'>
            <div className='relative'>
              <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
              <input
                placeholder='Search by content, ID or pubkey...'
                className='bg-muted w-full rounded-md py-2 pr-4 pl-8 text-sm outline-none focus:ring-1 focus:ring-orange-500'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={(e) => {
                  // Prevent auto-focus/keyboard on mobile unless explicitly desired
                  if (window.innerWidth < 768 && searchQuery === '') {
                    e.target.blur();
                  }
                }}
              />
            </div>
          </div>

          <div className='flex-1 space-y-3 overflow-y-auto px-6 pb-6'>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => {
                const isExpanded = expandedEvents[event.id];
                return (
                  <div
                    key={event.id}
                    className='bg-card text-card-foreground overflow-hidden rounded-lg border shadow-sm'
                  >
                    <button
                      onClick={() => toggleEventExpansion(event.id)}
                      className='hover:bg-muted/50 flex w-full items-start justify-between gap-4 p-4 text-left transition-colors'
                    >
                      <div className='space-y-1 overflow-hidden'>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-xs font-bold text-orange-600 dark:text-orange-400'>
                            {event.id.substring(0, 16)}...
                          </span>
                          <Badge variant='outline' className='h-4 text-[10px]'>
                            Kind {event.kind}
                          </Badge>
                        </div>
                        <div className='text-muted-foreground flex items-center gap-2 text-[10px]'>
                          <User className='h-3 w-3 shrink-0' />
                          <span className='truncate font-mono'>
                            {event.pubkey}
                          </span>
                        </div>
                      </div>
                      <div className='flex shrink-0 flex-col items-end gap-2'>
                        <div className='text-muted-foreground flex items-center gap-1 text-[10px]'>
                          <Clock className='h-3 w-3' />
                          {formatDistanceToNow(event.created_at * 1000)} ago
                        </div>
                        {isExpanded ? (
                          <ChevronUp className='text-muted-foreground h-4 w-4' />
                        ) : (
                          <ChevronDown className='text-muted-foreground h-4 w-4' />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className='bg-muted/10 space-y-4 border-t p-4 pt-0'>
                        {event.content && (
                          <div className='mt-4 space-y-1.5'>
                            <div className='text-muted-foreground flex items-center gap-1.5'>
                              <FileCode className='h-3 w-3' />
                              <span className='text-[10px] font-semibold tracking-wider uppercase'>
                                Content
                              </span>
                            </div>
                            <div className='bg-background max-h-48 overflow-y-auto rounded border p-3 font-sans text-sm break-words whitespace-pre-wrap'>
                              {event.content}
                            </div>
                          </div>
                        )}

                        <div className='space-y-1.5'>
                          <div className='flex items-center justify-between'>
                            <span className='text-muted-foreground text-[10px] font-semibold tracking-wider uppercase'>
                              Raw JSON
                            </span>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-5 px-1.5 text-[10px]'
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(
                                  JSON.stringify(event, null, 2)
                                );
                              }}
                            >
                              Copy JSON
                            </Button>
                          </div>
                          <pre className='max-h-64 overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300'>
                            {JSON.stringify(
                              {
                                id: event.id,
                                pubkey: event.pubkey,
                                created_at: event.created_at,
                                kind: event.kind,
                                tags: event.tags,
                                content: event.content,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className='text-muted-foreground py-12 text-center'>
                <p>No events found matching your criteria.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

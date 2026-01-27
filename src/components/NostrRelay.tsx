import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { nostrApi, NostrEvent } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export default function NostrRelay() {
  const { relayPort } = useAppStore();
  const [relayRunning, setRelayRunning] = useState(false);
  const [eventCounts, setEventCounts] = useState<Record<number, number>>({});
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [selectedKind, setSelectedKind] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

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
      console.error("Failed to check relay status:", error);
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
        searchQuery === "" ||
        e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.pubkey.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesKind && matchesSearch;
    });
  }, [events, selectedKind, searchQuery]);

  const toggleEventExpansion = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-2xl">
            <Radio className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Nostr Relay</h1>
            <p className="text-muted-foreground">
              Internal parallel relay for local event storage
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge
            variant={relayRunning ? "default" : "destructive"}
            className={relayRunning ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Activity className="w-3 h-3 mr-1" />
            {relayRunning ? "Online" : "Offline"}
          </Badge>
          <Badge variant="outline">Port {relayPort}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Connection URL
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-orange-600 dark:text-orange-400">
                ws://localhost:{relayPort}
              </code>
              <Button
                variant="ghost"
                size="sm"
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

      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 opacity-70">
            <DatabaseIcon className="w-4 h-4" />
            Stored Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">
              Backend: LMDB (High Performance)
              <br />
              Mode: Parallel Service
            </p>

            {Object.keys(eventCounts).length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Click a Kind to View Events
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {Object.entries(eventCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([kind, count]) => (
                      <button
                        key={kind}
                        onClick={() => setSelectedKind(Number(kind))}
                        className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-800/50 border hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors text-left"
                      >
                        <span className="text-xs font-mono font-bold">
                          Kind {kind}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 min-w-[2rem] justify-center"
                        >
                          {count}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              relayRunning && (
                <p className="text-xs text-muted-foreground italic">
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
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>Events (Kind {selectedKind})</span>
              <Badge variant="secondary">{filteredEvents.length} total</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search by content, ID or pubkey..."
                className="w-full bg-muted rounded-md pl-8 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={(e) => {
                  // Prevent auto-focus/keyboard on mobile unless explicitly desired
                  if (window.innerWidth < 768 && searchQuery === "") {
                    e.target.blur();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => {
                const isExpanded = expandedEvents[event.id];
                return (
                  <div
                    key={event.id}
                    className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => toggleEventExpansion(event.id)}
                      className="w-full p-4 flex items-start justify-between gap-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400">
                            {event.id.substring(0, 16)}...
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4">
                            Kind {event.kind}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="font-mono truncate">
                            {event.pubkey}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center text-[10px] text-muted-foreground gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(event.created_at * 1000)} ago
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 pt-0 space-y-4 border-t bg-muted/10">
                        {event.content && (
                          <div className="space-y-1.5 mt-4">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <FileCode className="w-3 h-3" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider">
                                Content
                              </span>
                            </div>
                            <div className="text-sm bg-background p-3 rounded border font-sans whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                              {event.content}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Raw JSON
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-[10px] px-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(JSON.stringify(event, null, 2));
                              }}
                            >
                              Copy JSON
                            </Button>
                          </div>
                          <pre className="text-[11px] bg-zinc-950 text-zinc-300 p-3 rounded border border-zinc-800 font-mono overflow-x-auto max-h-64">
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
              <div className="text-center py-12 text-muted-foreground">
                <p>No events found matching your criteria.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

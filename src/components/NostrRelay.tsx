import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Radio,
  Database as DatabaseIcon,
  Activity,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { nostrApi } from "@/lib/api";

export default function NostrRelay() {
  const { relayPort } = useAppStore();
  const [relayRunning, setRelayRunning] = useState(false);
  const [eventCounts, setEventCounts] = useState<Record<number, number>>({});

  const checkRelayStatus = async () => {
    try {
      const status = await nostrApi.getRelayStatus();
      setRelayRunning(status);

      if (status) {
        const counts = await nostrApi.getRelayEventCounts();
        setEventCounts(counts);
      } else {
        setEventCounts({});
      }
    } catch (error) {
      console.error("Failed to check relay status:", error);
      setRelayRunning(false);
      setEventCounts({});
    }
  };

  useEffect(() => {
    checkRelayStatus();
    const interval = setInterval(checkRelayStatus, 5000);
    return () => clearInterval(interval);
  }, []);

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
            Storage Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-mono">
              Backend: LMDB (High Performance)
              <br />
              Mode: Parallel Service
            </p>

            {Object.keys(eventCounts).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stored Events by Kind
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {Object.entries(eventCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([kind, count]) => (
                      <div
                        key={kind}
                        className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-800/50 border"
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
                      </div>
                    ))}
                </div>
              </div>
            )}

            {relayRunning && Object.keys(eventCounts).length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No events stored in the local relay yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

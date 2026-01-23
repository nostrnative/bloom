import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, RefreshCw, Database as DatabaseIcon, Shield, Activity } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { nostrApi } from "@/lib/api";

export default function NostrRelay() {
  const { relayPort, relayEnabled, setRelayEnabled } = useAppStore();
  const [relayRunning, setRelayRunning] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [eventCounts, setEventCounts] = useState<Record<number, number>>({});

  const checkRelayStatus = async () => {
    setIsChecking(true);
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
    } finally {
      setIsChecking(false);
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
          <Badge variant={relayRunning ? "default" : "destructive"} className={relayRunning ? "bg-green-600 hover:bg-green-700" : ""}>
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
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(`ws://localhost:${relayPort}`)}>
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            NIP Support
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {['01', '09', '11', '40'].map(nip => (
                <Badge key={nip} variant="secondary">NIP-{nip}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Relay Control
          </CardTitle>
          <CardDescription>
            Manage your internal Nostr relay lifecycle. Changes to port or enablement require an app restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
            <div>
              <p className="font-medium">Auto-start on launch</p>
              <p className="text-sm text-muted-foreground">The relay will start automatically when you open the app.</p>
            </div>
            <input 
              type="checkbox" 
              checked={relayEnabled} 
              onChange={(e) => setRelayEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={checkRelayStatus} 
              disabled={isChecking}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

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
              Backend: LMDB (High Performance)<br />
              Mode: Parallel Service
            </p>
            
            {Object.keys(eventCounts).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stored Events by Kind</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {Object.entries(eventCounts).sort(([a], [b]) => Number(a) - Number(b)).map(([kind, count]) => (
                    <div key={kind} className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-800/50 border">
                      <span className="text-xs font-mono font-bold">Kind {kind}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[2rem] justify-center">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {relayRunning && Object.keys(eventCounts).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No events stored in the local relay yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

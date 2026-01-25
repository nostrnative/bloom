import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { MultiInput } from "@/components/ui/multi-input";
import { nostrApi } from "@/lib/api";
import {
  Trash2,
  Plus,
  Server,
  Globe,
  ShieldCheck,
  RotateCw,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";

export default function Settings() {
  const {
    pubkey,
    relays,
    setRelays,
    theme,
    setTheme,
    localRelay,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    lastSyncTimestamp,
    interestedContactPubkeys,
    preferredPort,
    setPreferredPort,
    relayEnabled,
    setRelayEnabled,
    relayPort,
    setRelayPort,
    blossomPort,
    relayAllowedKinds,
    setRelayAllowedKinds,
    relayAllowedPubkeys,
    setRelayAllowedPubkeys,
    relayAllowedTaggedPubkeys,
    setRelayAllowedTaggedPubkeys,
    relayStartOnBoot,
    setRelayStartOnBoot,
  } = useAppStore();

  const [newRelay, setNewRelay] = useState("");
  const [inputPort, setInputPort] = useState(
    preferredPort?.toString() || blossomPort.toString(),
  );
  const [inputRelayPort, setInputRelayPort] = useState(relayPort.toString());
  const [error, setError] = useState("");
  const [applyStatus, setApplyStatus] = useState<
    "idle" | "success" | "restart"
  >("idle");

  const handleApplyPorts = () => {
    const bPort = parseInt(inputPort);
    const rPort = parseInt(inputRelayPort);

    if (isNaN(bPort) || bPort <= 0 || bPort > 65535) {
      setError("Invalid Blossom port");
      return;
    }
    if (isNaN(rPort) || rPort <= 0 || rPort > 65535) {
      setError("Invalid Relay port");
      return;
    }
    if (bPort === rPort) {
      setError("Blossom and Relay cannot use the same port");
      return;
    }

    setError("");
    setPreferredPort(bPort);
    setRelayPort(rPort);
    setApplyStatus("restart");
  };

  const handleRestart = async () => {
    try {
      await invoke("restart_app_instance");
    } catch (e) {
      console.error("Failed to restart:", e);
    }
  };

  const updateSync = async () => {
    await nostrApi.updateSyncSettings({
      local_relay: localRelay,
      remote_relays: relays,
      pubkey,
      interval_minutes: syncIntervalMinutes,
      enabled: syncEnabled,
      only_contacts: onlyContacts,
      last_sync_timestamp: lastSyncTimestamp,
      interested_contact_pubkeys: interestedContactPubkeys,
    });
  };

  useEffect(() => {
    updateSync();
  }, [
    localRelay,
    relays,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    interestedContactPubkeys,
    pubkey,
  ]);

  const addRelay = () => {
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay("");
    }
  };

  const removeRelay = (relay: string) => {
    setRelays(relays.filter((r) => r !== relay));
  };

  const hasChanges =
    inputPort !== (preferredPort?.toString() || blossomPort.toString()) ||
    inputRelayPort !== relayPort.toString();

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32">
      {/* General Settings Section */}
      <section id="general" className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold">General Settings</h2>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Configure how the application looks</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Appearance</span>
                <span className="text-xs text-muted-foreground">
                  Choose your preferred theme
                </span>
              </div>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as "light" | "dark" | "system")
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Blossom Server Section */}
      <section id="blossom" className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Server className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold">Blossom Server</h2>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader>
            <CardTitle>Server Configuration</CardTitle>
            <CardDescription>Configure your Blossom media server</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-6">
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Active Port</span>
                <span className="text-xs text-muted-foreground">
                  Current listening port
                </span>
              </div>
              <Badge className="bg-indigo-600 px-3 py-1">{blossomPort}</Badge>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Manual Port Override
              </label>
              <input
                type="number"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Default (24242)"
                value={inputPort}
                onChange={(e) => setInputPort(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground font-medium text-amber-600 dark:text-amber-400">
                Requires app restart to apply to the server.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Internal Relay Section */}
      <section id="relay" className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <RefreshCw className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold">Internal Nostr Relay</h2>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader>
            <CardTitle>Local Relay</CardTitle>
            <CardDescription>Run a local Nostr relay on this device</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Enable Relay</span>
                <span className="text-xs text-muted-foreground">
                  Run a local Nostr relay on this device
                </span>
              </div>
              <input
                type="checkbox"
                checked={relayEnabled}
                onChange={(e) => setRelayEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2 border-t pt-6">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Relay Port
              </label>
              <input
                type="number"
                value={inputRelayPort}
                onChange={(e) => setInputRelayPort(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              />
            </div>

            <div className="space-y-6 border-t pt-6">
              <h4 className="flex items-center font-bold text-xs uppercase tracking-widest text-muted-foreground">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Access Control
              </h4>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Allowed Event Kinds
                  </label>
                  <MultiInput
                    values={relayAllowedKinds.map(String)}
                    onChange={(vals) =>
                      setRelayAllowedKinds(
                        vals
                          .map((v) => parseInt(v))
                          .filter((v) => !isNaN(v)),
                      )
                    }
                    placeholder="e.g. 1, 30023"
                    type="number"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Allowed Pubkeys
                  </label>
                  <MultiInput
                    values={relayAllowedPubkeys}
                    onChange={setRelayAllowedPubkeys}
                    placeholder="npub... or hex"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Allowed Tagged Pubkeys
                  </label>
                  <MultiInput
                    values={relayAllowedTaggedPubkeys}
                    onChange={setRelayAllowedTaggedPubkeys}
                    placeholder="npub... or hex"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t pt-6">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={relayStartOnBoot}
                  onChange={(e) =>
                    setRelayStartOnBoot(e.target.checked)
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                Start on Boot
              </label>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Network Section */}
      <section id="network" className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Globe className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold">Nostr Network</h2>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader>
            <CardTitle>Remote Relays</CardTitle>
            <CardDescription>Configure remote relays for syncing</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-6">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="wss://..."
                value={newRelay}
                onChange={(e) => setNewRelay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRelay()}
              />
              <Button onClick={addRelay}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relays.map((relay) => (
                <div
                  key={relay}
                  className="group flex items-center justify-between rounded-xl border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors bg-white dark:bg-zinc-950"
                >
                  <span className="truncate text-xs font-mono opacity-80">
                    {relay}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRelay(relay)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Persistent Apply Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 left-6 md:left-[280px] lg:left-32 flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-lg dark:border-indigo-900/50 dark:bg-indigo-950 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 text-indigo-900 dark:text-indigo-100">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold">Unsaved Port Changes</p>
              <p className="text-[10px] opacity-80">
                Apply changes to update server configurations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <p className="mr-2 text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputPort(
                  preferredPort?.toString() || blossomPort.toString(),
                );
                setInputRelayPort(relayPort.toString());
                setError("");
              }}
            >
              Discard
            </Button>
            {applyStatus === "restart" ? (
              <Button
                size="sm"
                onClick={handleRestart}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Restart
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleApplyPorts}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Apply
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

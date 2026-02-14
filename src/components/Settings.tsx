import { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
  Skull,
  AlertTriangle,
  Zap,
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
    setBlossomPort,
    relayAllowedKinds,
    setRelayAllowedKinds,
    relayAllowedPubkeys,
    setRelayAllowedPubkeys,
    relayAllowedTaggedPubkeys,
    setRelayAllowedTaggedPubkeys,
    relayEnableSearch,
    setRelayEnableSearch,
  } = useAppStore();

  const [newRelay, setNewRelay] = useState("");
  const [inputPort, setInputPort] = useState(
    preferredPort?.toString() || blossomPort.toString(),
  );
  const [inputRelayPort, setInputRelayPort] = useState(relayPort.toString());
  const [inputAllowedKinds, setInputAllowedKinds] = useState(relayAllowedKinds);
  const [inputAllowedPubkeys, setInputAllowedPubkeys] =
    useState(relayAllowedPubkeys);
  const [inputAllowedTaggedPubkeys, setInputAllowedTaggedPubkeys] = useState(
    relayAllowedTaggedPubkeys,
  );
  const [inputEnableSearch, setInputEnableSearch] = useState(relayEnableSearch);
  const [error, setError] = useState("");

  const handleApplyPorts = async () => {
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
    const blossomChanged = bPort !== blossomPort;
    const relayChanged = rPort !== relayPort;

    setPreferredPort(bPort);
    setBlossomPort(bPort);
    setRelayPort(rPort);

    // Enforce port update immediately via invoke only if they changed
    try {
      if (blossomChanged) {
        await invoke("start_blossom_server", { port: bPort });
      }
      if (relayChanged && relayEnabled) {
        await invoke("start_relay_service", { port: rPort });
      }
    } catch (err) {
      console.error("Failed to apply port changes:", err);
    }

    setRelayAllowedKinds(inputAllowedKinds);
    setRelayAllowedPubkeys(inputAllowedPubkeys);
    setRelayAllowedTaggedPubkeys(inputAllowedTaggedPubkeys);
    setRelayEnableSearch(inputEnableSearch);
  };

  const hasChanges =
    inputPort !== (preferredPort?.toString() || blossomPort.toString()) ||
    inputRelayPort !== relayPort.toString() ||
    inputEnableSearch !== relayEnableSearch ||
    JSON.stringify(inputAllowedKinds) !== JSON.stringify(relayAllowedKinds) ||
    JSON.stringify(inputAllowedPubkeys) !==
      JSON.stringify(relayAllowedPubkeys) ||
    JSON.stringify(inputAllowedTaggedPubkeys) !==
      JSON.stringify(relayAllowedTaggedPubkeys);

  const updateSync = useCallback(async () => {
    await nostrApi.updateSyncSettings({
      local_relay: localRelay,
      remote_relays: relays,
      pubkey,
      interval_minutes: syncIntervalMinutes,
      enabled: syncEnabled,
      only_contacts: onlyContacts,
      last_sync_timestamp: lastSyncTimestamp,
      interested_contact_pubkeys: interestedContactPubkeys,
      relay_allowed_kinds: relayAllowedKinds,
      relay_allowed_pubkeys: relayAllowedPubkeys,
      relay_allowed_tagged_pubkeys: relayAllowedTaggedPubkeys,
      relay_enable_search: relayEnableSearch,
      relay_port: relayPort,
    });
  }, [
    localRelay,
    relays,
    pubkey,
    syncIntervalMinutes,
    syncEnabled,
    onlyContacts,
    lastSyncTimestamp,
    interestedContactPubkeys,
    relayAllowedKinds,
    relayAllowedPubkeys,
    relayAllowedTaggedPubkeys,
    relayEnableSearch,
    relayPort,
  ]);

  useEffect(() => {
    updateSync();
  }, [updateSync]);

  const addRelay = () => {
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay("");
    }
  };

  const removeRelay = (relay: string) => {
    setRelays(relays.filter((r) => r !== relay));
  };

  const handleClearBlossom = async () => {
    if (confirm("Are you sure? This will delete ALL your uploaded files! 😱")) {
      try {
        await invoke("clear_blossom_content");
        alert("Blossom content nuked! 💥");
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearRelay = async () => {
    if (confirm("Are you sure? This will delete ALL local relay events! 💀")) {
      try {
        await invoke("clear_relay_content");
        alert("Relay content wiped! 🧹");
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearBoth = async () => {
    if (
      confirm(
        "EXTREME DANGER! This will wipe EVERYTHING. Files, events, all of it. Continue? 🔥",
      )
    ) {
      try {
        await invoke("clear_blossom_content");
        await invoke("clear_relay_content");
        alert("TOTAL ANNIHILATION COMPLETE. 🌌");
      } catch (e) {
        console.error(e);
      }
    }
  };

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
            <CardDescription>
              Configure how the application looks
            </CardDescription>
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
            <CardDescription>
              Configure your Blossom media server
            </CardDescription>
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
            <CardDescription>
              Run a local Nostr relay on this device
            </CardDescription>
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
                onChange={async (e) => {
                  const enabled = e.target.checked;
                  setRelayEnabled(enabled);
                  try {
                    await invoke("toggle_relay", { enabled, port: relayPort });
                  } catch (err) {
                    console.error("Failed to toggle relay:", err);
                  }
                }}
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

            <div className="flex items-center justify-between border-t pt-6 opacity-60">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  NIP-50 Search (sqlite-vec){" "}
                  <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 font-bold ml-1">
                    COMING SOON
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Enable vector search for events
                </span>
              </div>
              <input
                type="checkbox"
                disabled
                checked={inputEnableSearch}
                onChange={(e) => setInputEnableSearch(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-not-allowed"
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
                    values={inputAllowedKinds.map(String)}
                    onChange={(vals) =>
                      setInputAllowedKinds(
                        vals.map((v) => parseInt(v)).filter((v) => !isNaN(v)),
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
                    values={inputAllowedPubkeys}
                    onChange={setInputAllowedPubkeys}
                    placeholder="npub... or hex"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Allowed Tagged Pubkeys
                  </label>
                  <MultiInput
                    values={inputAllowedTaggedPubkeys}
                    onChange={setInputAllowedTaggedPubkeys}
                    placeholder="npub... or hex"
                  />
                </div>
              </div>
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
            <CardDescription>
              Configure remote relays for syncing
            </CardDescription>
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

      {/* Danger Zone Section */}
      <section id="danger" className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Skull className="w-5 h-5 text-red-600 animate-pulse" />
          <h2 className="text-xl font-black text-red-600 tracking-tighter uppercase">
            The Point of No Return
          </h2>
        </div>
        <Card className="border-red-500/50 bg-red-50/30 dark:bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-shimmer" />
          <CardHeader className="border-b border-red-100 dark:border-red-900/50 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-700 dark:text-red-400">
                Danger Zone
              </CardTitle>
            </div>
            <CardDescription className="text-red-600/70 dark:text-red-400/70 font-medium">
              These actions are irreversible. Use with extreme caution (or if
              you're feeling spicy).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3 p-4 rounded-lg border border-red-200 dark:border-red-900/30 bg-white/50 dark:bg-zinc-900/50">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Server className="h-4 w-4" /> Blossom
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    Deletes all stored blobs and descriptors from your local
                    storage.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full font-bold uppercase tracking-wider"
                  onClick={handleClearBlossom}
                >
                  Nuke Blobs
                </Button>
              </div>

              <div className="space-y-3 p-4 rounded-lg border border-red-200 dark:border-red-900/30 bg-white/50 dark:bg-zinc-900/50">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> Relay
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    Wipes the entire local Nostr database. All local events will
                    be lost.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full font-bold uppercase tracking-wider"
                  onClick={handleClearRelay}
                >
                  Wipe Relay
                </Button>
              </div>

              <div className="space-y-3 p-4 rounded-lg border-2 border-red-600 bg-red-600/5 dark:bg-red-600/10">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black flex items-center gap-2 text-red-600 uppercase italic">
                    <Zap className="h-4 w-4 fill-current" /> Total Wipeout
                  </span>
                  <span className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed font-bold">
                    Everything goes. Blossom content, Relay events, and your
                    dignity.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  onClick={handleClearBoth}
                >
                  Annihilate All
                </Button>
              </div>
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
                setInputAllowedKinds(relayAllowedKinds);
                setInputAllowedPubkeys(relayAllowedPubkeys);
                setInputAllowedTaggedPubkeys(relayAllowedTaggedPubkeys);
                setInputEnableSearch(relayEnableSearch);
                setError("");
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleApplyPorts}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

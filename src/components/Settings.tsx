import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { MultiInput } from "@/components/ui/multi-input";
import { nostrApi, UserProfile } from "@/lib/api";
import {
  Trash2,
  Plus,
  RefreshCw,
  Server,
  Globe,
  User,
  ShieldCheck,
  RotateCw,
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

type SettingsTab = "account" | "blossom" | "relay" | "network";

export default function Settings() {
  const {
    nsec,
    pubkey,
    setCredentials,
    relays,
    setRelays,
    logout,
    theme,
    setTheme,
    localRelay,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    lastSyncTimestamp,
    getAllRelays,
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

  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [inputNsec, setInputNsec] = useState(nsec || "");
  const [newRelay, setNewRelay] = useState("");
  const [inputPort, setInputPort] = useState(
    preferredPort?.toString() || blossomPort.toString(),
  );
  const [inputRelayPort, setInputRelayPort] = useState(relayPort.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applyStatus, setApplyStatus] = useState<
    "idle" | "success" | "restart"
  >("idle");
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (nsec) {
      updateSync();
    }
  }, [
    localRelay,
    relays,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    interestedContactPubkeys,
  ]);

  // React Query for Contacts
  const contactsQuery = useQuery({
    queryKey: ["contacts", pubkey],
    queryFn: () =>
      pubkey ? nostrApi.fetchContactList(pubkey, getAllRelays()) : [],
    enabled: !!pubkey && !!nsec,
  });

  const contacts = contactsQuery.data || [];

  // React Query for Profiles
  useQuery({
    queryKey: ["profiles", contacts.map((c) => c.pubkey)],
    queryFn: async () => {
      const pks = contacts.map((c) => c.pubkey);
      if (pks.length === 0) return {};
      const fetchedProfiles = await nostrApi.fetchProfiles(pks, getAllRelays());
      const profileMap: Record<string, UserProfile> = {};
      fetchedProfiles.forEach((p) => {
        profileMap[p.pubkey] = p;
      });
      return profileMap;
    },
    enabled: contacts.length > 0,
  });

  const verifyAndConnect = async (keyToVerify: string) => {
    setLoading(true);
    setError("");
    try {
      const pubkey = await nostrApi.verifyNsec(keyToVerify.trim());
      setCredentials(keyToVerify.trim(), pubkey);
      queryClient.invalidateQueries();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    setLoading(true);
    try {
      const newKey = await nostrApi.generateNsec();
      setInputNsec(newKey);
      await verifyAndConnect(newKey);
    } catch (e: any) {
      setError("Failed to generate keys: " + e.toString());
      setLoading(false);
    }
  };

  const addRelay = () => {
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay("");
    }
  };

  const removeRelay = (relay: string) => {
    setRelays(relays.filter((r) => r !== relay));
  };

  const updateSync = async () => {
    await nostrApi.updateSyncSettings({
      local_relay: localRelay,
      remote_relays: relays,
      pubkey,
      nsec,
      interval_minutes: syncIntervalMinutes,
      enabled: syncEnabled,
      only_contacts: onlyContacts,
      last_sync_timestamp: lastSyncTimestamp,
      interested_contact_pubkeys: interestedContactPubkeys,
    });
  };

  if (nsec) {
    const hasChanges =
      inputPort !== (preferredPort?.toString() || blossomPort.toString()) ||
      inputRelayPort !== relayPort.toString();

    return (
      <div className="flex h-full flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-48 overflow-x-auto lg:overflow-x-visible">
          <nav className="flex flex-row gap-1 lg:flex-col min-w-max lg:min-w-0 pb-2 lg:pb-0 scrollbar-none">
            <Button
              variant={activeTab === "account" ? "default" : "ghost"}
              className="justify-start flex-none lg:flex-none h-9 px-3 lg:px-4"
              onClick={() => setActiveTab("account")}
            >
              <User className="mr-2 h-4 w-4" />
              Account
            </Button>
            <Button
              variant={activeTab === "blossom" ? "default" : "ghost"}
              className="justify-start flex-none lg:flex-none h-9 px-3 lg:px-4"
              onClick={() => setActiveTab("blossom")}
            >
              <Server className="mr-2 h-4 w-4" />
              Blossom
            </Button>
            <Button
              variant={activeTab === "relay" ? "default" : "ghost"}
              className="justify-start flex-none lg:flex-none h-9 px-3 lg:px-4"
              onClick={() => setActiveTab("relay")}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Relay
            </Button>
            <Button
              variant={activeTab === "network" ? "default" : "ghost"}
              className="justify-start flex-none lg:flex-none h-9 px-3 lg:px-4"
              onClick={() => setActiveTab("network")}
            >
              <Globe className="mr-2 h-4 w-4" />
              Network
            </Button>
          </nav>
        </aside>

        <main className="flex-1 space-y-6 pb-20">
          {activeTab === "account" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Account Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your Nostr identity and app appearance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Public Key
                    </label>
                    <div className="flex flex-col rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900 border">
                      <code className="break-all text-xs font-mono text-zinc-800 dark:text-zinc-200">
                        {pubkey}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
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

                  <div className="flex justify-end pt-4 border-t">
                    <Button variant="destructive" size="sm" onClick={logout}>
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "blossom" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Server className="mr-2 h-5 w-5" />
                    Blossom Server
                  </CardTitle>
                  <CardDescription>
                    Configure your Blossom media server
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900 border">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Active Port</span>
                      <span className="text-xs text-muted-foreground">
                        Current listening port
                      </span>
                    </div>
                    <Badge className="bg-indigo-600">{blossomPort}</Badge>
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
            </div>
          )}

          {activeTab === "relay" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Internal Nostr Relay
                    </CardTitle>
                    <input
                      type="checkbox"
                      checked={relayEnabled}
                      onChange={(e) => setRelayEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <CardDescription>
                    Run a local Nostr relay on this device
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Relay Port
                    </label>
                    <input
                      type="number"
                      value={inputRelayPort}
                      onChange={(e) => setInputRelayPort(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-6 border-t pt-4">
                    <h4 className="flex items-center font-bold text-xs uppercase tracking-widest text-muted-foreground">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Access Control
                    </h4>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
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
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
                          Allowed Pubkeys
                        </label>
                        <MultiInput
                          values={relayAllowedPubkeys}
                          onChange={setRelayAllowedPubkeys}
                          placeholder="npub... or hex"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
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

                  <div className="space-y-6 border-t pt-4">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground text-[10px]">
                      System Settings
                    </h4>
                    <div className="flex items-center gap-2">
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
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "network" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Globe className="mr-2 h-5 w-5" />
                    Nostr Network
                  </CardTitle>
                  <CardDescription>
                    Configure remote relays for syncing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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

                  <div className="space-y-2">
                    {relays.map((relay) => (
                      <div
                        key={relay}
                        className="group flex items-center justify-between rounded-md border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors bg-white dark:bg-zinc-950"
                      >
                        <span className="truncate text-sm font-mono">
                          {relay}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRelay(relay)}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Persistent Apply Bar */}
          {hasChanges && (
            <div className="fixed bottom-6 right-6 left-6 md:left-[280px] lg:left-[calc(16rem+48px)] flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-lg dark:border-indigo-900/50 dark:bg-indigo-950 animate-in fade-in slide-in-from-bottom-4">
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
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Connect with your Nostr identity to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Nostr Private Key (nsec)
            </label>
            <input
              type="password"
              value={inputNsec}
              onChange={(e) => setInputNsec(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="nsec1..."
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => verifyAndConnect(inputNsec)}
              disabled={loading || !inputNsec}
            >
              {loading ? "Connecting..." : "Connect"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGenerateKeys}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Generate New Identity
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

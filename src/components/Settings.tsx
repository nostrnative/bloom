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
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    relayAuthEnabled,
    setRelayAuthEnabled,
    relayAllowedKinds,
    setRelayAllowedKinds,
    relayAllowedPubkeys,
    setRelayAllowedPubkeys,
    relayAllowedTaggedPubkeys,
    setRelayAllowedTaggedPubkeys,
    relayUseSSL,
    setRelayUseSSL,
    relayHost,
    setRelayHost,
    relayAutoBackup,
    setRelayAutoBackup,
    relayAutoBackupFolder,
    setRelayAutoBackupFolder,
    relayStartOnBoot,
    setRelayStartOnBoot,
    relayUseProxy,
    setRelayUseProxy,
    relayProxyPort,
    setRelayProxyPort,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [inputNsec, setInputNsec] = useState(nsec || "");
  const [newRelay, setNewRelay] = useState("");
  const [inputPort, setInputPort] = useState(preferredPort?.toString() || "");
  const [inputRelayPort, setInputRelayPort] = useState(relayPort.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const handlePortChange = (value: string) => {
    setInputPort(value);
    const port = parseInt(value);
    if (!isNaN(port) && port > 0 && port < 65536) {
      setPreferredPort(port);
    } else if (value === "") {
      setPreferredPort(null);
    }
  };

  const handleRelayPortChange = (value: string) => {
    setInputRelayPort(value);
    const port = parseInt(value);
    if (!isNaN(port) && port > 0 && port < 65536) {
      setRelayPort(port);
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
    return (
      <div className="flex h-full flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-48">
          <nav className="flex flex-row gap-1 lg:flex-col">
            <Button
              variant={activeTab === "account" ? "default" : "ghost"}
              className="justify-start flex-1 lg:flex-none"
              onClick={() => setActiveTab("account")}
            >
              <User className="mr-2 h-4 w-4" />
              Account
            </Button>
            <Button
              variant={activeTab === "blossom" ? "default" : "ghost"}
              className="justify-start flex-1 lg:flex-none"
              onClick={() => setActiveTab("blossom")}
            >
              <Server className="mr-2 h-4 w-4" />
              Blossom
            </Button>
            <Button
              variant={activeTab === "relay" ? "default" : "ghost"}
              className="justify-start flex-1 lg:flex-none"
              onClick={() => setActiveTab("relay")}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Relay
            </Button>
            <Button
              variant={activeTab === "network" ? "default" : "ghost"}
              className="justify-start flex-1 lg:flex-none"
              onClick={() => setActiveTab("network")}
            >
              <Globe className="mr-2 h-4 w-4" />
              Network
            </Button>
          </nav>
        </aside>

        <main className="flex-1 space-y-6">
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
                      onChange={(e) => handlePortChange(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
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
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Relay Port
                    </label>
                    <input
                      type="number"
                      value={inputRelayPort}
                      onChange={(e) => handleRelayPortChange(e.target.value)}
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

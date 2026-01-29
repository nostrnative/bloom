import { useEffect, useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import Settings from "@/components/Settings";
import BlossomServer from "@/components/BlossomServer";
import NostrRelay from "@/components/NostrRelay";
import { Button } from "@/components/ui/button";
import {
  Settings as SettingsIcon,
  Server,
  Radio,
  AlertCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";

import { nostrApi } from "@/lib/api";

const queryClient = new QueryClient();

function SyncManager() {
  const {
    pubkey,
    relays,
    localRelay,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    lastSyncTimestamp,
    interestedContactPubkeys,
    relayAllowedKinds,
    relayAllowedPubkeys,
    relayAllowedTaggedPubkeys,
    relayPort,
    relayEnabled,
  } = useAppStore();

  useEffect(() => {
    // Initial sync settings update
    nostrApi.updateSyncSettings({
      local_relay: localRelay,
      remote_relays: relays,
      pubkey,
      interval_minutes: syncIntervalMinutes,
      enabled: syncEnabled,
      only_contacts: onlyContacts,
      last_sync_timestamp: lastSyncTimestamp,
      interested_contact_pubkeys: interestedContactPubkeys,
      relay_enabled: relayEnabled,
      relay_allowed_kinds: relayAllowedKinds,
      relay_allowed_pubkeys: relayAllowedPubkeys,
      relay_allowed_tagged_pubkeys: relayAllowedTaggedPubkeys,
      relay_port: relayPort,
    });
  }, [
    pubkey,
    relays,
    localRelay,
    syncEnabled,
    syncIntervalMinutes,
    onlyContacts,
    lastSyncTimestamp,
    interestedContactPubkeys,
    relayAllowedKinds,
    relayAllowedPubkeys,
    relayAllowedTaggedPubkeys,
    relayPort,
    relayEnabled,
  ]);

  return null;
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<
    "server" | "relay" | "settings"
  >("server");
  const {
    theme,
    blossomPort,
    setBlossomPort,
    relayPort,
    setRelayPort,
    relayEnabled,
  } = useAppStore();
  const [error, setError] = useState<string | null>(null);

  const startBlossom = useCallback(
    async (port: number): Promise<boolean> => {
      try {
        const activePort = await invoke<number>("start_blossom_server", {
          port,
        });
        setBlossomPort(activePort);
        return true;
      } catch (err) {
        if (err === "PORT_IN_USE") {
          const confirmed = await ask(
            `Blossom port ${port} is in use. Try port ${port + 1}?`,
            { title: "Port Conflict", kind: "warning" },
          );
          if (confirmed) {
            return startBlossom(port + 1);
          }
        } else {
          setError(`Failed to start Blossom: ${err}`);
        }
        return false;
      }
    },
    [setBlossomPort],
  );

  const startRelay = useCallback(
    async (port: number): Promise<boolean> => {
      try {
        const activePort = await invoke<number>("start_relay_service", {
          port,
        });
        setRelayPort(activePort);
        return true;
      } catch (err) {
        console.log(err);
        if (err === "PORT_IN_USE") {
          const confirmed = await ask(
            `Relay port ${port} is in use. Try port ${port + 1}?`,
            { title: "Port Conflict", kind: "warning" },
          );
          if (confirmed) {
            return startRelay(port + 1);
          }
        } else {
          setError(`Failed to start Relay: ${err}`);
        }
        return false;
      }
    },
    [setRelayPort],
  );

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // Small delay to ensure everything is ready
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!mounted) return;

      try {
        const bSuccess = await startBlossom(blossomPort || 24242);
        if (mounted && bSuccess && relayEnabled) {
          await startRelay(relayPort || 4869);
        }
      } catch (e) {
        console.error("Startup error:", e);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [blossomPort, relayPort, relayEnabled, startBlossom, startRelay]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const applySystemTheme = () => {
        root.classList.remove("light", "dark");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
      };

      applySystemTheme();

      mediaQuery.addEventListener("change", applySystemTheme);
      return () => mediaQuery.removeEventListener("change", applySystemTheme);
    }

    root.classList.add(theme);
  }, [theme]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="fixed top-0 right-0 left-0 z-50 h-[env(safe-area-inset-top)] bg-zinc-950" />
      <div className="flex h-full flex-col md:flex-row">
        <nav className="flex h-16 w-full items-center justify-between px-4 bg-zinc-100 py-2 dark:bg-zinc-900 md:h-full md:w-16 md:flex-col md:justify-start md:space-y-4 md:py-4 md:px-0 md:items-center">
          <div className="flex items-center justify-center pb-0 md:pb-2">
            <img
              src="/logo.png"
              alt="Blossom Logo"
              className="h-10 w-10 rounded-xl"
            />
          </div>
          <div className="flex flex-1 justify-around items-center md:flex-col md:space-y-4 md:justify-start">
            <Button
              variant={currentPage === "server" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentPage("server")}
            >
              <Server className="h-5 w-5" />
            </Button>
            <Button
              variant={currentPage === "relay" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentPage("relay")}
            >
              <Radio className="h-5 w-5" />
            </Button>
            <Button
              variant={currentPage === "settings" ? "default" : "ghost"}
              size="icon"
              onClick={() => setCurrentPage("settings")}
            >
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </div>
        </nav>
        <div className="flex-1 overflow-auto p-4 md:p-6 relative">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-auto"
              >
                Dismiss
              </Button>
            </div>
          )}
          {currentPage === "server" ? (
            <BlossomServer />
          ) : currentPage === "relay" ? (
            <NostrRelay />
          ) : (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-3xl font-bold mb-6">Settings</h1>
              <Settings />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncManager />
      <AppContent />
    </QueryClientProvider>
  );
}

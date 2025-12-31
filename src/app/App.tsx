import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import Settings from "@/components/Settings";
import BlossomServer from "@/components/BlossomServer";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Server } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

const queryClient = new QueryClient();

function AppContent() {
  const [currentPage, setCurrentPage] = useState<"server" | "settings">(
    "server",
  );
  const { theme, setBlossomPort } = useAppStore();

  useEffect(() => {
    const initPort = async () => {
      try {
        const activePort = await invoke<number>("get_server_port");
        if (activePort && activePort !== 0) {
          setBlossomPort(activePort);
          return true; // Found port
        }
      } catch (error) {
        console.error("Failed to fetch server port:", error);
      }
      return false; // Port not found yet
    };

    // Try immediately
    initPort().then((found) => {
      if (!found) {
        // If not found, poll every second until we get it
        const interval = setInterval(async () => {
          if (await initPort()) {
            clearInterval(interval);
          }
        }, 1000);
        return () => clearInterval(interval);
      }
    });
  }, [setBlossomPort]);

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
      <div className="flex h-full">
        <nav className="w-16 bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center py-4 space-y-4">
          <Button
            variant={currentPage === "server" ? "default" : "ghost"}
            size="icon"
            onClick={() => setCurrentPage("server")}
          >
            <Server className="w-5 h-5" />
          </Button>
          <Button
            variant={currentPage === "settings" ? "default" : "ghost"}
            size="icon"
            onClick={() => setCurrentPage("settings")}
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </nav>
        <div className="flex-1 overflow-auto p-6">
          {currentPage === "server" ? (
            <BlossomServer />
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
      <AppContent />
    </QueryClientProvider>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  SunIcon,
  MoonIcon,
  BellIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { BusinessSelector } from "./BusinessSelector";
import { useBusiness } from "@/contexts/BusinessContext";

const pageTitles: Record<string, string> = {
  "/": "Chat",
  "/agents": "Agents",
  "/listing": "My Listing",
  "/deployments": "Deployments",
  "/edits": "Edit History",
  "/account": "Account",
};

export function GlobalHeader() {
  const location = useLocation();
  const { selectedBusinessId, setSelectedBusinessId, isAdmin } = useBusiness();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "dark" | "light") || "dark";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const pageTitle = pageTitles[location.pathname] || "Dashboard";

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#27272a] bg-[#141419]/80 backdrop-blur-sm">
      {/* Left: Page title + Business selector */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-neutral-100">
          {pageTitle}
        </h1>
        {isAdmin && (
          <BusinessSelector
            selectedBusinessId={selectedBusinessId}
            onSelect={setSelectedBusinessId}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 transition-colors">
          <BellIcon size={20} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 transition-colors"
        >
          {theme === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>

        {/* User menu */}
        <button className="flex items-center gap-2 p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 transition-colors">
          <UserCircleIcon size={24} />
        </button>
      </div>
    </header>
  );
}

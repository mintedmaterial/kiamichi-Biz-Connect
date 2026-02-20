import { useState, useEffect, useCallback } from "react";
import { useAgent } from "agents/react";
import { UserCircleIcon, BuildingsIcon, GearIcon, FloppyDiskIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";

interface BusinessAgentState {
  businessId: number;
  businessName: string;
  businessSlug: string;
  ownerId: string;
  preferences: {
    tone: "professional" | "casual" | "friendly" | "informative";
    autoPublish: boolean;
    contentLength: "short" | "medium" | "long";
    seoFocus: string[];
  };
  lastActiveAt: string;
  sessionMessageCount: number;
  totalMessageCount: number;
}

export function AccountPage() {
  const agent = useAgent({ agent: "chat", name: "default" });
  
  const [state, setState] = useState<BusinessAgentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state
  const [tone, setTone] = useState<BusinessAgentState["preferences"]["tone"]>("professional");
  const [contentLength, setContentLength] = useState<BusinessAgentState["preferences"]["contentLength"]>("medium");
  const [autoPublish, setAutoPublish] = useState(false);

  // Load initial state
  useEffect(() => {
    async function loadState() {
      try {
        const result = await agent.call("getAgentState") as BusinessAgentState;
        setState(result);
        setTone(result.preferences.tone);
        setContentLength(result.preferences.contentLength);
        setAutoPublish(result.preferences.autoPublish);
      } catch (error) {
        console.error("[Account] Failed to load state:", error);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, [agent]);

  // Track changes
  useEffect(() => {
    if (!state) return;
    const changed = 
      tone !== state.preferences.tone ||
      contentLength !== state.preferences.contentLength ||
      autoPublish !== state.preferences.autoPublish;
    setHasChanges(changed);
  }, [tone, contentLength, autoPublish, state]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await agent.call("updatePreferences", [{ tone, contentLength, autoPublish }]) as BusinessAgentState;
      setState(result);
      setHasChanges(false);
    } catch (error) {
      console.error("[Account] Failed to save preferences:", error);
    } finally {
      setSaving(false);
    }
  }, [agent, tone, contentLength, autoPublish]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      const result = await agent.call("resetPreferences") as BusinessAgentState;
      setState(result);
      setTone(result.preferences.tone);
      setContentLength(result.preferences.contentLength);
      setAutoPublish(result.preferences.autoPublish);
      setHasChanges(false);
    } catch (error) {
      console.error("[Account] Failed to reset preferences:", error);
    } finally {
      setSaving(false);
    }
  }, [agent]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Account</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Manage your account settings and preferences
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#27272a] text-neutral-300 hover:bg-neutral-800/50 transition-colors disabled:opacity-50"
            >
              <ArrowCounterClockwiseIcon size={18} />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              <FloppyDiskIcon size={18} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <div className="p-6 rounded-xl bg-[#141419] border border-[#27272a]">
          <h3 className="font-semibold text-lg text-neutral-100 mb-4 flex items-center gap-2">
            <UserCircleIcon size={20} className="text-amber-500" />
            Profile
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <span className="text-white text-xl font-bold">
                  {state?.businessName?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <p className="font-medium text-neutral-100">{state?.businessName || "Business Owner"}</p>
                <p className="text-sm text-neutral-400">ID: {state?.ownerId || "Not set"}</p>
              </div>
            </div>
            <div className="text-sm text-neutral-500 space-y-1">
              <p>Session messages: {state?.sessionMessageCount || 0}</p>
              <p>Total messages: {state?.totalMessageCount || 0}</p>
              <p>Last active: {state?.lastActiveAt ? new Date(state.lastActiveAt).toLocaleString() : "Never"}</p>
            </div>
          </div>
        </div>

        {/* Business Info Card */}
        <div className="p-6 rounded-xl bg-[#141419] border border-[#27272a]">
          <h3 className="font-semibold text-lg text-neutral-100 mb-4 flex items-center gap-2">
            <BuildingsIcon size={20} className="text-amber-500" />
            Business
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500">Business Name</label>
              <p className="text-neutral-100">{state?.businessName || "Not set"}</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Business ID</label>
              <p className="text-neutral-100">{state?.businessId || "Not set"}</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">URL Slug</label>
              <p className="text-neutral-100 font-mono text-sm">
                {state?.businessSlug ? `/${state.businessSlug}` : "Not set"}
              </p>
            </div>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="p-6 rounded-xl bg-[#141419] border border-[#27272a] md:col-span-2">
          <h3 className="font-semibold text-lg text-neutral-100 mb-4 flex items-center gap-2">
            <GearIcon size={20} className="text-amber-500" />
            AI Preferences
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm text-neutral-400">Writing Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D0F] border border-[#27272a] text-neutral-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="friendly">Friendly</option>
                <option value="informative">Informative</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-400">Content Length</label>
              <select
                value={contentLength}
                onChange={(e) => setContentLength(e.target.value as typeof contentLength)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D0F] border border-[#27272a] text-neutral-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
            <div className="flex items-center justify-between md:col-span-2 p-3 rounded-lg bg-[#0D0D0F] border border-[#27272a]">
              <div>
                <p className="text-neutral-100">Auto-publish changes</p>
                <p className="text-xs text-neutral-500">Automatically publish approved edits without confirmation</p>
              </div>
              <button
                onClick={() => setAutoPublish(!autoPublish)}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  autoPublish ? "bg-amber-500" : "bg-neutral-700"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoPublish ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

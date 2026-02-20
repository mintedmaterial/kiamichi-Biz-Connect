import { RobotIcon, PlusIcon, GearIcon } from "@phosphor-icons/react";

export function AgentsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Your Agents</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Manage AI agents deployed for your business
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors">
          <PlusIcon size={18} />
          <span>New Agent</span>
        </button>
      </div>

      {/* Agent cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Business Chat Agent */}
        <div className="p-5 rounded-xl bg-[#141419] border border-[#27272a] hover:border-amber-500/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <RobotIcon size={24} className="text-amber-500" />
            </div>
            <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400">
              Active
            </span>
          </div>
          <h3 className="font-semibold text-lg text-neutral-100 mb-1">
            Business Chat
          </h3>
          <p className="text-sm text-neutral-400 mb-4">
            AI assistant for managing your business listing
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">124 conversations</span>
            <button className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors">
              <GearIcon size={18} />
            </button>
          </div>
        </div>

        {/* Voice Agent */}
        <div className="p-5 rounded-xl bg-[#141419] border border-[#27272a] hover:border-amber-500/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <RobotIcon size={24} className="text-cyan-400" />
            </div>
            <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400">
              Active
            </span>
          </div>
          <h3 className="font-semibold text-lg text-neutral-100 mb-1">
            Voice Agent
          </h3>
          <p className="text-sm text-neutral-400 mb-4">
            Voice-enabled customer service
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">38 calls</span>
            <button className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors">
              <GearIcon size={18} />
            </button>
          </div>
        </div>

        {/* Add new agent card */}
        <div className="p-5 rounded-xl border-2 border-dashed border-[#27272a] hover:border-amber-500/50 flex flex-col items-center justify-center min-h-[200px] cursor-pointer transition-colors group">
          <div className="w-12 h-12 rounded-xl bg-[#141419] flex items-center justify-center mb-3 group-hover:bg-amber-500/10 transition-colors">
            <PlusIcon size={24} className="text-neutral-500 group-hover:text-amber-500 transition-colors" />
          </div>
          <span className="text-neutral-400 group-hover:text-amber-500 font-medium transition-colors">
            Add Agent
          </span>
        </div>
      </div>
    </div>
  );
}

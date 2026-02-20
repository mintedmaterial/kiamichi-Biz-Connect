import { RocketLaunchIcon, GlobeIcon, CodeIcon } from "@phosphor-icons/react";

export function DeploymentsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">Deployments</h2>
        <p className="text-neutral-400 text-sm mt-1">
          Manage deployed apps, websites, and features
        </p>
      </div>

      {/* Deployment cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Business Listing */}
        <div className="p-5 rounded-xl bg-[#141419] border border-[#27272a] hover:border-amber-500/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <GlobeIcon size={24} className="text-amber-500" />
            </div>
            <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400">
              Live
            </span>
          </div>
          <h3 className="font-semibold text-lg text-neutral-100 mb-1">
            Business Listing
          </h3>
          <p className="text-sm text-neutral-400 mb-2">
            kiamichibizconnect.com/your-business
          </p>
          <span className="text-xs text-neutral-500">
            Last updated: 2 hours ago
          </span>
        </div>

        {/* Landing Page */}
        <div className="p-5 rounded-xl bg-[#141419] border border-[#27272a] hover:border-amber-500/30 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <CodeIcon size={24} className="text-purple-400" />
            </div>
            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400">
              Draft
            </span>
          </div>
          <h3 className="font-semibold text-lg text-neutral-100 mb-1">
            Landing Page
          </h3>
          <p className="text-sm text-neutral-400 mb-2">
            Custom landing page template
          </p>
          <span className="text-xs text-neutral-500">
            Last updated: Yesterday
          </span>
        </div>

        {/* Coming soon placeholder */}
        <div className="p-5 rounded-xl border-2 border-dashed border-[#27272a] flex flex-col items-center justify-center min-h-[200px]">
          <RocketLaunchIcon size={32} className="text-neutral-600 mb-3" />
          <span className="text-neutral-500 font-medium">More Coming Soon</span>
          <p className="text-xs text-neutral-600 mt-1 text-center">
            Deploy custom apps, websites, and AI features
          </p>
        </div>
      </div>
    </div>
  );
}

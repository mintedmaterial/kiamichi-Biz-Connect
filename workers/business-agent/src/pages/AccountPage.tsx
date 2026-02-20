import { UserCircleIcon, EnvelopeIcon, BuildingsIcon, GearIcon } from "@phosphor-icons/react";

export function AccountPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">Account</h2>
        <p className="text-neutral-400 text-sm mt-1">
          Manage your account settings and preferences
        </p>
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
                <span className="text-white text-xl font-bold">U</span>
              </div>
              <div>
                <p className="font-medium text-neutral-100">Business Owner</p>
                <p className="text-sm text-neutral-400">owner@business.com</p>
              </div>
            </div>
            <button className="w-full px-4 py-2 rounded-lg border border-[#27272a] text-neutral-300 hover:bg-neutral-800/50 transition-colors">
              Edit Profile
            </button>
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
              <p className="text-neutral-100">Your Business Name</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Category</label>
              <p className="text-neutral-100">Services</p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Location</label>
              <p className="text-neutral-100">Kiamichi Valley, OK</p>
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
              <select className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D0F] border border-[#27272a] text-neutral-100">
                <option>Professional</option>
                <option>Casual</option>
                <option>Friendly</option>
                <option>Informative</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-400">Content Length</label>
              <select className="mt-1 w-full px-3 py-2 rounded-lg bg-[#0D0D0F] border border-[#27272a] text-neutral-100">
                <option>Short</option>
                <option>Medium</option>
                <option>Long</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-100">Auto-publish changes</p>
                <p className="text-xs text-neutral-500">Automatically publish approved edits</p>
              </div>
              <button className="w-12 h-6 rounded-full bg-neutral-700 relative">
                <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-neutral-400 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

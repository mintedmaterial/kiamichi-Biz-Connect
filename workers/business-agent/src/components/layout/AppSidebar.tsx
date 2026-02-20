import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  RobotIcon,
  StorefrontIcon,
  RocketLaunchIcon,
  ClockCounterClockwiseIcon,
  UserCircleIcon,
  ChatCircleDotsIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";

const navItems = [
  { path: "/", icon: ChatCircleDotsIcon, label: "Chat", exact: true },
  { path: "/agents", icon: RobotIcon, label: "Agents" },
  { path: "/listing", icon: StorefrontIcon, label: "Listing" },
  { path: "/deployments", icon: RocketLaunchIcon, label: "Deployments" },
  { path: "/edits", icon: ClockCounterClockwiseIcon, label: "Edit History" },
  { path: "/account", icon: UserCircleIcon, label: "Account" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        ${collapsed ? "w-16" : "w-64"}
        flex flex-col
        bg-[#141419]
        border-r border-[#27272a]
        transition-all duration-200
      `}
    >
      {/* Logo/Header */}
      <div className="h-14 flex items-center px-4 border-b border-[#27272a]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <span className="font-semibold text-amber-500">KBC Agent</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors duration-150
                  ${isActive
                    ? "bg-amber-500/10 text-amber-500"
                    : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
                  }
                `}
              >
                <item.icon size={20} weight="regular" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-[#27272a]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 transition-colors"
        >
          {collapsed ? <CaretRightIcon size={18} /> : <CaretLeftIcon size={18} />}
        </button>
      </div>
    </aside>
  );
}

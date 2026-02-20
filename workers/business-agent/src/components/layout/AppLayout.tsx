import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { GlobalHeader } from "./GlobalHeader";

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-[#0D0D0F] text-neutral-100">
      {/* Sidebar */}
      <AppSidebar />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalHeader />
        <main className="flex-1 overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

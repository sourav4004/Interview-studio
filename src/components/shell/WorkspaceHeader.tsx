"use client";

import React from "react";

import { usePathname, useRouter } from "next/navigation";
import { Menu, User, Bell, LogOut } from "lucide-react";
import { WORKSPACE_NAV_ITEMS } from "./WorkspaceSidebar";
import { Badge } from "@/components/ui/Badge";
import { authClient } from "@/lib/auth-client";
import type { AuthenticatedUser } from "@/server/auth/session";

export interface WorkspaceHeaderProps {
  onToggleSidebar: () => void;
  user?: AuthenticatedUser;
}

export function WorkspaceHeader({ onToggleSidebar, user }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Find matching nav title
  const currentNav = WORKSPACE_NAV_ITEMS.find((item) => item.href === pathname);
  const title = currentNav ? currentNav.name : "Workspace";

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open sidebar navigation"
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-[#171827] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-[#171827]">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="primary" className="hidden sm:inline-flex">
          Better Auth Active
        </Badge>

        <button
          type="button"
          disabled
          aria-label="Notifications"
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-40 cursor-not-allowed"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User indicator & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3730A3] flex items-center justify-center font-medium text-xs border border-indigo-200">
            {user?.name ? user.name.slice(0, 1).toUpperCase() : <User className="w-4 h-4 text-[#4F46E5]" />}
          </div>
          <span className="text-xs font-medium text-slate-700 hidden md:inline max-w-[120px] truncate">
            {user?.name || user?.email || "Guest User"}
          </span>

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out of workspace"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}


"use client";

import React, { useState } from "react";
import { WorkspaceSidebar } from "@/components/shell/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/shell/WorkspaceHeader";
import { X } from "lucide-react";
import type { AuthenticatedUser } from "@/server/auth/session";

export interface WorkspaceLayoutClientProps {
  children: React.ReactNode;
  user?: AuthenticatedUser;
}

export function WorkspaceLayoutClient({
  children,
  user,
}: WorkspaceLayoutClientProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Keyboard accessible skip-to-content link */}
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#4F46E5] focus:text-white focus:rounded-md focus:shadow-md"
      >
        Skip to main content
      </a>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30">
          <WorkspaceSidebar />
        </div>

        {/* Mobile Drawer Backdrop & Sidebar */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden flex"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer */}
            <div className="relative flex flex-col w-64 max-w-xs bg-white shadow-xl z-50">
              <div className="absolute top-3 right-3">
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close navigation drawer"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <WorkspaceSidebar onNavClick={() => setMobileDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Workspace Column */}
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <WorkspaceHeader
            user={user}
            onToggleSidebar={() => setMobileDrawerOpen(true)}
          />
          <main
            id="workspace-content"
            tabIndex={-1}
            className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

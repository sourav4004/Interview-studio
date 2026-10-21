"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlayCircle,
  History,
  TrendingUp,
  Settings,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Start Interview",
    href: "/start-interview",
    icon: PlayCircle,
    badge: "Wizard",
  },
  {
    name: "Interview History",
    href: "/history",
    icon: History,
  },
  {
    name: "My Progress",
    href: "/progress",
    icon: TrendingUp,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export interface WorkspaceSidebarProps {
  onNavClick?: () => void;
  className?: string;
}

export function WorkspaceSidebar({ onNavClick, className }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Workspace Sidebar"
      className={cn(
        "flex flex-col h-full bg-white border-r border-slate-200 w-64 select-none",
        className
      )}
    >
      {/* Brand & App Title */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white font-bold text-sm shadow-xs">
          AI
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-[#171827] leading-tight">
            AI Interviewer
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Workspace Shell
          </span>
        </div>
      </div>

      {/* Navigation links */}
      <nav aria-label="Sidebar Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Workspace
        </div>
        {WORKSPACE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-1",
                isActive
                  ? "bg-[#EEF2FF] text-[#3730A3] font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-[#171827]"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-[#4F46E5]" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    isActive
                      ? "bg-white text-[#3730A3] border-indigo-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Shell Disclaimer & Return */}
      <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/60">
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200/80 text-xs">
          <ShieldCheck className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
          <div className="text-slate-600 leading-tight">
            <span className="font-semibold text-slate-800 block mb-0.5">
              Shell Visual Baseline
            </span>
            Auth & database unlinked in Milestone 2.
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-[#171827] hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Landing Page</span>
        </Link>
      </div>
    </aside>
  );
}

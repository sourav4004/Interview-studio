"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight, LayoutDashboard } from "lucide-react";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-indigo-100 bg-white/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white font-bold text-base shadow-xs">
            AI
          </div>
          <div>
            <span className="font-semibold text-lg text-[#171827] tracking-tight">
              AI Interview Simulator
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-6"
        >
          <a
            href="#modes"
            className="text-sm font-medium text-slate-600 hover:text-[#4F46E5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded-md px-1"
          >
            Interview Modes
          </a>
          <a
            href="#principles"
            className="text-sm font-medium text-slate-600 hover:text-[#4F46E5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded-md px-1"
          >
            Architecture
          </a>
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-[#4F46E5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] rounded-md px-1"
          >
            Sign In
          </Link>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#3730A3] border border-indigo-200">
            Phase 4 · Foundation
          </span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Workspace</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </nav>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="p-2 rounded-lg text-slate-600 hover:text-[#171827] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-indigo-100 bg-white px-4 py-4 space-y-3 shadow-lg">
          <nav aria-label="Mobile Navigation" className="flex flex-col space-y-2">
            <a
              href="#modes"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#EEF2FF] hover:text-[#3730A3] rounded-lg transition-colors"
            >
              Interview Modes
            </a>
            <a
              href="#principles"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#EEF2FF] hover:text-[#3730A3] rounded-lg transition-colors"
            >
              Architecture Principles
            </a>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#EEF2FF] hover:text-[#3730A3] rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] shadow-xs"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Open Workspace</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

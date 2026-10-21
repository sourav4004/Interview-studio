import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/session";
import { WorkspaceLayoutClient } from "@/components/shell/WorkspaceLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Server-side protected layout for the authenticated workspace.
 *
 * Verifies active session with 7-day idle and 30-day absolute expiration checks.
 * Unauthenticated visitors are redirected to the sign-in page with return URL context.
 * Public pages (e.g. landing page) remain accessible without a session.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login?redirect=/dashboard");
  }

  return (
    <WorkspaceLayoutClient user={session.user}>
      {children}
    </WorkspaceLayoutClient>
  );
}

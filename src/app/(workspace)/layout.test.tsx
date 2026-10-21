import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import * as navigationModule from "next/navigation";

// Mock server session module
vi.mock("@/server/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

import { getCurrentSession } from "@/server/auth/session";
import type { AuthenticatedSession, AuthenticatedUser } from "@/server/auth/session";
import WorkspaceLayout from "./layout";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/dashboard"),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

describe("Protected Workspace Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated visitors to /login with redirect context", async () => {
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    await expect(
      WorkspaceLayout({
        children: <div data-testid="workspace-child">Child Content</div>,
      })
    ).rejects.toThrow("REDIRECT:/login?redirect=/dashboard");

    expect(navigationModule.redirect).toHaveBeenCalledWith(
      "/login?redirect=/dashboard"
    );
  });

  it("renders workspace layout with user info when user is authenticated", async () => {
    const mockUser: AuthenticatedUser = {
      id: "u-1",
      email: "student@example.com",
      name: "Alex Morgan",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSession: AuthenticatedSession = {
      user: mockUser,
      session: {
        id: "s-1",
        userId: "u-1",
        token: "tok-1",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    vi.mocked(getCurrentSession).mockResolvedValueOnce(mockSession);


    const result = await WorkspaceLayout({
      children: <div data-testid="workspace-child">Protected Workspace Content</div>,
    });

    render(result);

    expect(screen.getByTestId("workspace-child")).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByLabelText("Sign out")).toBeInTheDocument();
  });
});

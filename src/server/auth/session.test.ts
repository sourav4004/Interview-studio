// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { getCurrentSession } from "./session";
import { auth } from "@/server/auth";


// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe("Server-Side Session Retrieval (getCurrentSession)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session is present in request headers", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null as never);

    const session = await getCurrentSession();
    expect(session).toBeNull();
  });

  it("returns authenticated session when session is active and within 30-day absolute lifetime", async () => {
    const validSession = {
      user: {
        id: "user-1",
        email: "student@example.com",
        name: "Test Student",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-1",
        userId: "user-1",
        token: "valid-session-token",
        expiresAt: new Date(Date.now() + 604800000), // 7 days ahead
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days old
        updatedAt: new Date(),
      },
    };

    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(validSession as never);

    const session = await getCurrentSession();
    expect(session).not.toBeNull();
    expect(session?.user.email).toBe("student@example.com");
    expect(session?.session.token).toBe("valid-session-token");
  });

  it("terminates and returns null when session exceeds 30-day absolute lifetime", async () => {
    const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
    const expiredAbsoluteSession = {
      user: {
        id: "user-2",
        email: "old-student@example.com",
        name: "Old Student",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "session-2",
        userId: "user-2",
        token: "expired-absolute-token",
        expiresAt: new Date(Date.now() + 604800000), // Still valid in sliding window
        createdAt: new Date(Date.now() - thirtyOneDaysMs), // Created 31 days ago!
        updatedAt: new Date(),
      },
    };

    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(
      expiredAbsoluteSession as never
    );
    const revokeSpy = vi
      .spyOn(auth.api, "revokeSession")
      .mockResolvedValueOnce({} as never);

    const session = await getCurrentSession();
    expect(session).toBeNull();
    expect(revokeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { token: "expired-absolute-token" },
      })
    );
  });
});

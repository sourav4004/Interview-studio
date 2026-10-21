// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { auth } from "./auth";
import {
  handleSendVerificationEmail,
  setCustomEmailHandler,
  VerificationEmailPayload,
} from "./auth/email";
import { prisma } from "./db";

describe("Better Auth Server Configuration", () => {
  it("initializes Better Auth with configured options and options shape", () => {
    expect(auth).toBeDefined();
    expect(auth.options).toBeDefined();
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.getSession).toBe("function");
    expect(typeof auth.api.signInEmail).toBe("function");
    expect(typeof auth.api.signUpEmail).toBe("function");
    expect(typeof auth.api.signOut).toBe("function");
  });

  it("enforces documented password length bounds (8 to 128 characters)", () => {
    const emailAndPassword = auth.options.emailAndPassword;
    expect(emailAndPassword).toBeDefined();
    expect(emailAndPassword?.enabled).toBe(true);
    expect(emailAndPassword?.minPasswordLength).toBe(8);
    expect(emailAndPassword?.maxPasswordLength).toBe(128);
  });

  it("enforces 7-day idle session duration and 1-day rolling update window", () => {
    const sessionConfig = auth.options.session;
    expect(sessionConfig).toBeDefined();
    // 7 days in seconds: 7 * 24 * 60 * 60 = 604,800
    expect(sessionConfig?.expiresIn).toBe(604800);
    // 1 day in seconds: 24 * 60 * 60 = 86,400
    expect(sessionConfig?.updateAge).toBe(86400);
    // 5-minute cookie cache enabled
    expect(sessionConfig?.cookieCache?.enabled).toBe(true);
    expect(sessionConfig?.cookieCache?.maxAge).toBe(300);
  });

  it("configures email verification with 24-hour lifetime and send-on-signup", () => {
    const emailVerification = auth.options.emailVerification;
    expect(emailVerification).toBeDefined();
    expect(emailVerification?.sendOnSignUp).toBe(true);
    expect(emailVerification?.autoSignInAfterVerification).toBe(true);
    // 24 hours in seconds: 24 * 60 * 60 = 86,400
    expect(emailVerification?.expiresIn).toBe(86400);
  });

  it("configures secure cookie attributes (HttpOnly, SameSite=Lax)", () => {
    const advanced = auth.options.advanced;
    expect(advanced?.defaultCookieAttributes).toBeDefined();
    expect(advanced?.defaultCookieAttributes?.httpOnly).toBe(true);
    expect(advanced?.defaultCookieAttributes?.sameSite).toBe("lax");
    expect(advanced?.defaultCookieAttributes?.path).toBe("/");
  });

  it("prunes excess sessions when user has 5 or more existing sessions via database hook", async () => {
    const beforeHook =
      auth.options.databaseHooks?.session?.create?.before;
    expect(beforeHook).toBeDefined();

    const mockUserId = "test-user-limit-123";
    const existingSessions = [
      { id: "s1", userId: mockUserId, createdAt: new Date("2026-10-17T10:00:00Z") },
      { id: "s2", userId: mockUserId, createdAt: new Date("2026-10-17T09:00:00Z") },
      { id: "s3", userId: mockUserId, createdAt: new Date("2026-10-17T08:00:00Z") },
      { id: "s4", userId: mockUserId, createdAt: new Date("2026-10-17T07:00:00Z") },
      { id: "s5", userId: mockUserId, createdAt: new Date("2026-10-17T06:00:00Z") },
    ];

    // Spy on prisma.session methods
    const findManySpy = vi
      .spyOn(prisma.session, "findMany")
      // @ts-expect-error Mocking Prisma return
      .mockResolvedValueOnce(existingSessions);
    const deleteManySpy = vi
      .spyOn(prisma.session, "deleteMany")
      .mockResolvedValueOnce({ count: 1 });


    const newSession = {
      id: "s-new",
      userId: mockUserId,
      token: "new-token-abc",
      expiresAt: new Date(Date.now() + 604800000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // @ts-expect-error Testing database hook invocation
    const result = await beforeHook(newSession, {} as never);
    expect(result).toEqual({ data: newSession });
    expect(findManySpy).toHaveBeenCalledWith({
      where: { userId: mockUserId },
      orderBy: { createdAt: "desc" },
    });
    // Oldest session (s5) pruned so total will not exceed 5
    expect(deleteManySpy).toHaveBeenCalledWith({
      where: { id: { in: ["s5"] } },
    });

    findManySpy.mockRestore();
    deleteManySpy.mockRestore();
  });
});

describe("Email Verification Dispatch Handler", () => {
  beforeEach(() => {
    setCustomEmailHandler(null);
  });

  it("routes through custom handler when registered without exposing secrets", async () => {
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    setCustomEmailHandler(mockHandler);

    const payload: VerificationEmailPayload = {
      user: {
        id: "user-123",
        email: "student@example.com",
        name: "Test Student",
      },
      url: "https://example.com/api/auth/verify-email?token=safe-token-value",
      token: "safe-token-value",
    };

    await handleSendVerificationEmail(payload);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(payload);
  });

  it("handles unconfigured email provider gracefully without throwing", async () => {
    setCustomEmailHandler(null);

    const payload: VerificationEmailPayload = {
      user: {
        id: "user-456",
        email: "student2@example.com",
        name: "Another Student",
      },
      url: "https://example.com/api/auth/verify-email?token=safe-token-2",
      token: "safe-token-2",
    };

    await expect(handleSendVerificationEmail(payload)).resolves.not.toThrow();
  });
});

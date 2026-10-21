// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGuestSession,
  validateGuestSession,
  assertGuestOwnership,
  grantGuestConsent,
  withdrawGuestConsent,
  cleanupExpiredGuestSessions,
} from "./service";
import { hashGuestToken } from "./crypto";
import {
  GuestSessionExpiredError,
  GuestSessionNotFoundError,
  GuestUnauthorizedError,
} from "./errors";
import { prisma } from "@/server/db";

describe("Server-Side Guest Session Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGuestSession", () => {
    it("generates an opaque raw token and persists only its SHA-256 hash", async () => {
      const mockCreated = {
        id: "guest-uuid-1",
        tokenHash: "hashed-token-value",
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
        consentAiQuestions: false,
        consentAiEvaluation: false,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      };

      const createSpy = vi
        .spyOn(prisma.guestSession, "create")
        .mockResolvedValueOnce(mockCreated);

      const result = await createGuestSession({
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
      });

      expect(result.rawToken).toBeDefined();
      expect(result.rawToken.length).toBe(64); // 32 bytes hex
      expect(result.session.id).toBe("guest-uuid-1");

      // Verify rawToken was NOT sent to Prisma; only the SHA-256 hash was sent
      expect(createSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: hashGuestToken(result.rawToken),
          ipAddress: "127.0.0.1",
          userAgent: "TestAgent",
        }),
      });
    });
  });

  describe("validateGuestSession", () => {
    it("successfully validates an active, unexpired guest token", async () => {
      const rawToken = "my-valid-test-guest-token";
      const tokenHash = hashGuestToken(rawToken);

      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce({
        id: "guest-uuid-2",
        tokenHash,
        expiresAt: new Date(Date.now() + 60000), // unexpired
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });

      const session = await validateGuestSession(rawToken);
      expect(session.id).toBe("guest-uuid-2");
      expect(session.consentAiQuestions).toBe(true);
    });

    it("throws GuestSessionNotFoundError when token does not match any stored hash", async () => {
      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce(null);

      await expect(
        validateGuestSession("non-existent-token")
      ).rejects.toThrow(GuestSessionNotFoundError);
    });

    it("throws GuestSessionExpiredError when token is past its expiration date", async () => {
      const rawToken = "my-expired-guest-token";
      const tokenHash = hashGuestToken(rawToken);

      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce({
        id: "guest-uuid-expired",
        tokenHash,
        expiresAt: new Date(Date.now() - 10000), // expired 10s ago
        createdAt: new Date(Date.now() - 86410000),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });

      await expect(validateGuestSession(rawToken)).rejects.toThrow(
        GuestSessionExpiredError
      );
    });
  });

  describe("assertGuestOwnership", () => {
    it("resolves when the guest token matches the resource ownership", async () => {
      const rawToken = "token-matching-guest-3";
      const tokenHash = hashGuestToken(rawToken);

      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce({
        id: "guest-3",
        tokenHash,
        expiresAt: new Date(Date.now() + 50000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: false,
        consentAiEvaluation: false,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });

      const session = await assertGuestOwnership(rawToken, "guest-3");
      expect(session.id).toBe("guest-3");
    });

    it("throws GuestUnauthorizedError when the guest token belongs to a different guest session", async () => {
      const rawToken = "token-belonging-to-guest-4";
      const tokenHash = hashGuestToken(rawToken);

      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce({
        id: "guest-4",
        tokenHash,
        expiresAt: new Date(Date.now() + 50000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: false,
        consentAiEvaluation: false,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });

      await expect(
        assertGuestOwnership(rawToken, "guest-target-different")
      ).rejects.toThrow(GuestUnauthorizedError);
    });
  });

  describe("grantGuestConsent & withdrawGuestConsent", () => {
    it("grants temporary consent and writes to audit log", async () => {
      const rawToken = "token-guest-consent";
      const tokenHash = hashGuestToken(rawToken);

      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce({
        id: "guest-5",
        tokenHash,
        expiresAt: new Date(Date.now() + 50000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: false,
        consentAiEvaluation: false,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });

      const updateSpy = vi.fn().mockResolvedValue({
        id: "guest-5",
        tokenHash,
        expiresAt: new Date(Date.now() + 50000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });
      const auditSpy = vi.fn().mockResolvedValue({ id: "audit-1" });

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          guestSession: { update: updateSpy },
          consentAuditLog: { create: auditSpy },
        } as never);
      });

      const updated = await grantGuestConsent(rawToken, [
        "ai_questions",
        "ai_evaluation",
      ]);

      expect(updated.consentAiQuestions).toBe(true);
      expect(updated.consentAiEvaluation).toBe(true);
      expect(auditSpy).toHaveBeenCalledTimes(2);
      expect(auditSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guestSessionId: "guest-5",
          purpose: "ai_questions",
          action: "granted",
        }),
      });
    });

    it("withdraws temporary consent and writes withdrawal to audit log", async () => {
      const rawToken = "token-guest-withdraw";
      const tokenHash = hashGuestToken(rawToken);

      vi.spyOn(prisma.guestSession, "findUnique").mockResolvedValueOnce({
        id: "guest-6",
        tokenHash,
        expiresAt: new Date(Date.now() + 50000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });

      const updateSpy = vi.fn().mockResolvedValue({
        id: "guest-6",
        tokenHash,
        expiresAt: new Date(Date.now() + 50000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        consentAiQuestions: false,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        noticeVersion: "1.0",
      });
      const auditSpy = vi.fn().mockResolvedValue({ id: "audit-2" });

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          guestSession: { update: updateSpy },
          consentAuditLog: { create: auditSpy },
        } as never);
      });

      const updated = await withdrawGuestConsent(rawToken, ["ai_questions"]);

      expect(updated.consentAiQuestions).toBe(false);
      expect(auditSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guestSessionId: "guest-6",
          purpose: "ai_questions",
          action: "withdrawn",
        }),
      });
    });
  });


  describe("cleanupExpiredGuestSessions", () => {
    it("deletes guest sessions where expiresAt <= now", async () => {
      const deleteSpy = vi
        .spyOn(prisma.guestSession, "deleteMany")
        .mockResolvedValueOnce({ count: 4 });

      const cleanedCount = await cleanupExpiredGuestSessions();
      expect(cleanedCount).toBe(4);
      expect(deleteSpy).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lte: expect.any(Date),
          },
        },
      });
    });
  });
});

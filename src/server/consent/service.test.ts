// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUserConsent,
  grantConsent,
  withdrawConsent,
  assertConsent,
  assertRequiredAiConsent,
  getConsentAuditTrail,
} from "./service";
import { ConsentRequiredError, ConsentUnavailableError } from "./errors";
import { prisma } from "@/server/db";

describe("Server-Side Purpose-Specific Consent Service", () => {
  const testUserId = "user-consent-test-101";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserConsent", () => {
    it("returns safe defaults (all false) when no consent record exists", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce(null);

      const state = await getUserConsent(testUserId);
      expect(state.ai_questions).toBe(false);
      expect(state.ai_evaluation).toBe(false);
      expect(state.resume_processing).toBe(false);
      expect(state.saved_resume).toBe(false);
      expect(state.personalization).toBe(false);
      expect(state.noticeVersion).toBe("1.0");
    });

    it("returns established consent state when record exists", async () => {
      const mockRecord = {
        id: "c-1",
        userId: testUserId,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        consentPersonalization: true,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce(mockRecord);

      const state = await getUserConsent(testUserId);
      expect(state.ai_questions).toBe(true);
      expect(state.ai_evaluation).toBe(true);
      expect(state.resume_processing).toBe(false);
      expect(state.saved_resume).toBe(false);
      expect(state.personalization).toBe(true);
    });

    it("fails closed with ConsentUnavailableError when query fails", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockRejectedValueOnce(
        new Error("DB connection failure")
      );

      await expect(getUserConsent(testUserId)).rejects.toThrow(
        ConsentUnavailableError
      );
    });
  });

  describe("grantConsent & withdrawConsent", () => {
    it("grants specific purposes atomically and creates audit log records", async () => {
      const mockUpdatedRecord = {
        id: "c-2",
        userId: testUserId,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false,
        consentSavedResume: false,
        consentPersonalization: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const upsertSpy = vi.fn().mockResolvedValue(mockUpdatedRecord);
      const auditCreateSpy = vi.fn().mockResolvedValue({ id: "log-1" });

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          userConsent: { upsert: upsertSpy },
          consentAuditLog: { create: auditCreateSpy },
        } as never);
      });

      const result = await grantConsent(
        testUserId,
        ["ai_questions", "ai_evaluation"],
        {
          ipAddress: "127.0.0.1",
          userAgent: "TestAgent/1.0",
        }
      );

      expect(result.ai_questions).toBe(true);
      expect(result.ai_evaluation).toBe(true);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: testUserId },
          update: expect.objectContaining({
            consentAiQuestions: true,
            consentAiEvaluation: true,
          }),
        })
      );
      expect(auditCreateSpy).toHaveBeenCalledTimes(2);
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUserId,
          purpose: "ai_questions",
          action: "granted",
        }),
      });
    });

    it("immediately withdraws consent and writes withdrawal audit records", async () => {
      const mockUpdatedRecord = {
        id: "c-3",
        userId: testUserId,
        consentAiQuestions: false,
        consentAiEvaluation: false,
        consentResumeProcessing: false,
        consentSavedResume: false,
        consentPersonalization: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const upsertSpy = vi.fn().mockResolvedValue(mockUpdatedRecord);
      const auditCreateSpy = vi.fn().mockResolvedValue({ id: "log-2" });

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          userConsent: { upsert: upsertSpy },
          consentAuditLog: { create: auditCreateSpy },
        } as never);
      });

      const result = await withdrawConsent(testUserId, ["ai_questions"]);

      expect(result.ai_questions).toBe(false);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: testUserId },
          update: expect.objectContaining({
            consentAiQuestions: false,
          }),
        })
      );
      expect(auditCreateSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: testUserId,
          purpose: "ai_questions",
          action: "withdrawn",
        }),
      });
    });
  });

  describe("assertConsent & assertRequiredAiConsent", () => {
    it("assertConsent resolves when purpose is actively granted", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-4",
        userId: testUserId,
        consentAiQuestions: true,
        consentAiEvaluation: false,
        consentResumeProcessing: false,
        consentSavedResume: false,
        consentPersonalization: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(assertConsent(testUserId, "ai_questions")).resolves.not.toThrow();
    });

    it("assertConsent blocks and throws ConsentRequiredError when purpose is missing", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce(null);

      await expect(assertConsent(testUserId, "ai_questions")).rejects.toThrow(
        ConsentRequiredError
      );
    });

    it("assertRequiredAiConsent blocks when ai_evaluation consent is missing", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-5",
        userId: testUserId,
        consentAiQuestions: true,
        consentAiEvaluation: false, // missing required
        consentResumeProcessing: false,
        consentSavedResume: false,
        consentPersonalization: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(assertRequiredAiConsent(testUserId)).rejects.toThrow(
        ConsentRequiredError
      );
    });

    it("assertRequiredAiConsent blocks when resume context is used but resume_processing consent is missing", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-6",
        userId: testUserId,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: false, // missing for resume mode
        consentSavedResume: false,
        consentPersonalization: false,
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        assertRequiredAiConsent(testUserId, { hasResume: true })
      ).rejects.toThrow(/resume content processing is required/i);
    });

    it("assertRequiredAiConsent succeeds when all required consents are present", async () => {
      vi.spyOn(prisma.userConsent, "findUnique").mockResolvedValueOnce({
        id: "c-7",
        userId: testUserId,
        consentAiQuestions: true,
        consentAiEvaluation: true,
        consentResumeProcessing: true,
        consentSavedResume: false, // optional, not required
        consentPersonalization: false, // optional, not required
        noticeVersion: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        assertRequiredAiConsent(testUserId, { hasResume: true })
      ).resolves.not.toThrow();
    });
  });

  describe("getConsentAuditTrail", () => {
    it("returns chronological audit log records", async () => {
      const mockLogs = [
        {
          id: "log-1",
          userId: testUserId,
          guestSessionId: null,
          purpose: "ai_questions",
          action: "granted",
          noticeVersion: "1.0",
          timestamp: new Date("2026-10-17T10:00:00Z"),
          ipAddress: "127.0.0.1",
          userAgent: "Browser/1.0",
        },
      ];

      vi.spyOn(prisma.consentAuditLog, "findMany").mockResolvedValueOnce(mockLogs);

      const trail = await getConsentAuditTrail(testUserId);
      expect(trail).toHaveLength(1);
      expect(trail[0].purpose).toBe("ai_questions");
      expect(trail[0].action).toBe("granted");
    });
  });
});

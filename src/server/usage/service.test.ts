// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkUsageAllowance,
  reserveUsage,
  commitUsage,
  releaseUsage,
  withUsageReservation,
} from "./service";
import { UsageLimitExceededError, UsageInvalidActorError } from "./errors";

// Mock Prisma
vi.mock("@/server/db", () => {
  return {
    prisma: {
      usageRecord: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) =>
        callback({
          usageRecord: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
          },
        })
      ),
    },
  };
});

import { prisma } from "@/server/db";

describe("Usage Tracking & Atomic Quota Reservation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkUsageAllowance", () => {
    it("throws UsageInvalidActorError if neither userId nor guestSessionId is provided", async () => {
      await expect(checkUsageAllowance({})).rejects.toThrow(
        UsageInvalidActorError
      );
    });

    it("returns allowed: true when user is below daily limit", async () => {
      vi.mocked(prisma.usageRecord.findMany).mockResolvedValueOnce([
        { unitsReserved: 1 },
        { unitsReserved: 1 },
      ] as unknown as Awaited<ReturnType<typeof prisma.usageRecord.findMany>>);

      const status = await checkUsageAllowance({ userId: "user-1" });
      expect(status.allowed).toBe(true);
      expect(status.consumed).toBe(2);
      expect(status.limit).toBe(10);
      expect(status.remaining).toBe(8);
    });

    it("returns allowed: false when user has reached daily limit", async () => {
      vi.mocked(prisma.usageRecord.findMany).mockResolvedValueOnce(
        Array(10).fill({ unitsReserved: 1 }) as unknown as Awaited<ReturnType<typeof prisma.usageRecord.findMany>>
      );

      const status = await checkUsageAllowance({ userId: "user-1" });
      expect(status.allowed).toBe(false);
      expect(status.consumed).toBe(10);
      expect(status.remaining).toBe(0);
    });

    it("uses separate guest limit for guest sessions", async () => {
      vi.mocked(prisma.usageRecord.findMany).mockResolvedValueOnce([
        { unitsReserved: 1 },
        { unitsReserved: 1 },
        { unitsReserved: 1 },
      ] as unknown as Awaited<ReturnType<typeof prisma.usageRecord.findMany>>);

      const status = await checkUsageAllowance({ guestSessionId: "guest-1" });
      expect(status.allowed).toBe(false);
      expect(status.limit).toBe(3);
      expect(status.consumed).toBe(3);
    });
  });

  describe("reserveUsage", () => {
    it("successfully creates a reserved usage record when within limit", async () => {
      const mockRecord = {
        id: "usage-rec-1",
        userId: "user-1",
        guestSessionId: null,
        interviewId: null,
        action: "question_generation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return (callback as (tx: unknown) => Promise<unknown>)({
          usageRecord: {
            findMany: vi.fn().mockResolvedValueOnce([]),
            create: vi.fn().mockResolvedValueOnce(mockRecord),
          },
        }) as Promise<typeof mockRecord>;
      });

      const reservation = await reserveUsage({ userId: "user-1" }, "question_generation");
      expect(reservation.id).toBe("usage-rec-1");
      expect(reservation.status).toBe("reserved");
      expect(reservation.unitsReserved).toBe(1);
    });

    it("throws UsageLimitExceededError when quota is exceeded inside transaction", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return (callback as (tx: unknown) => Promise<unknown>)({
          usageRecord: {
            findMany: vi
              .fn()
              .mockResolvedValueOnce(Array(10).fill({ unitsReserved: 1 })),
            create: vi.fn(),
          },
        }) as Promise<never>;
      });

      await expect(
        reserveUsage({ userId: "user-1" }, "question_generation")
      ).rejects.toThrow(UsageLimitExceededError);
    });
  });

  describe("commitUsage", () => {
    it("transitions status to committed with token usage metadata", async () => {
      const mockUpdated = {
        id: "usage-rec-1",
        userId: "user-1",
        guestSessionId: null,
        interviewId: "int-1",
        action: "question_generation",
        status: "committed",
        unitsReserved: 1,
        promptTokens: 450,
        completionTokens: 220,
        totalTokens: 670,
        model: "gemini-3.5-flash-lite",
        createdAt: new Date(),
      };

      vi.mocked(prisma.usageRecord.update).mockResolvedValueOnce(
        mockUpdated as unknown as Awaited<ReturnType<typeof prisma.usageRecord.update>>
      );

      const committed = await commitUsage("usage-rec-1", {
        promptTokens: 450,
        completionTokens: 220,
        totalTokens: 670,
        model: "gemini-3.5-flash-lite",
      });

      expect(committed.status).toBe("committed");
      expect(prisma.usageRecord.update).toHaveBeenCalledWith({
        where: { id: "usage-rec-1" },
        data: expect.objectContaining({
          status: "committed",
          promptTokens: 450,
          completionTokens: 220,
          totalTokens: 670,
          model: "gemini-3.5-flash-lite",
        }),
      });
    });
  });

  describe("releaseUsage", () => {
    it("transitions status to released so quota is returned", async () => {
      const mockReleased = {
        id: "usage-rec-1",
        userId: "user-1",
        guestSessionId: null,
        interviewId: null,
        action: "question_generation",
        status: "released",
        unitsReserved: 1,
        createdAt: new Date(),
      };

      vi.mocked(prisma.usageRecord.update).mockResolvedValueOnce(
        mockReleased as unknown as Awaited<ReturnType<typeof prisma.usageRecord.update>>
      );

      const released = await releaseUsage("usage-rec-1");
      expect(released.status).toBe("released");
      expect(prisma.usageRecord.update).toHaveBeenCalledWith({
        where: { id: "usage-rec-1" },
        data: expect.objectContaining({ status: "released" }),
      });
    });
  });

  describe("withUsageReservation", () => {
    it("commits reservation when operation succeeds", async () => {
      const mockRecord = {
        id: "usage-rec-1",
        userId: "user-1",
        guestSessionId: null,
        interviewId: null,
        action: "question_generation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return (callback as (tx: unknown) => Promise<unknown>)({
          usageRecord: {
            findMany: vi.fn().mockResolvedValueOnce([]),
            create: vi.fn().mockResolvedValueOnce(mockRecord),
          },
        }) as Promise<typeof mockRecord>;
      });

      vi.mocked(prisma.usageRecord.update).mockResolvedValueOnce({
        ...mockRecord,
        status: "committed",
      } as unknown as Awaited<ReturnType<typeof prisma.usageRecord.update>>);

      const result = await withUsageReservation(
        { userId: "user-1" },
        "question_generation",
        async () => {
          return {
            result: { success: true },
            metadata: { totalTokens: 100 },
          };
        }
      );

      expect(result).toEqual({ success: true });
      expect(prisma.usageRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usage-rec-1" },
          data: expect.objectContaining({ status: "committed" }),
        })
      );
    });

    it("releases reservation when operation throws error and rethrows", async () => {
      const mockRecord = {
        id: "usage-rec-1",
        userId: "user-1",
        guestSessionId: null,
        interviewId: null,
        action: "question_generation",
        status: "reserved",
        unitsReserved: 1,
        createdAt: new Date(),
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return (callback as (tx: unknown) => Promise<unknown>)({
          usageRecord: {
            findMany: vi.fn().mockResolvedValueOnce([]),
            create: vi.fn().mockResolvedValueOnce(mockRecord),
          },
        }) as Promise<typeof mockRecord>;
      });

      vi.mocked(prisma.usageRecord.update).mockResolvedValueOnce({
        ...mockRecord,
        status: "released",
      } as unknown as Awaited<ReturnType<typeof prisma.usageRecord.update>>);

      await expect(
        withUsageReservation(
          { userId: "user-1" },
          "question_generation",
          async () => {
            throw new Error("AI provider failed");
          }
        )
      ).rejects.toThrow("AI provider failed");

      expect(prisma.usageRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usage-rec-1" },
          data: expect.objectContaining({ status: "released" }),
        })
      );
    });
  });
});

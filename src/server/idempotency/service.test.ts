// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  withIdempotency,
  cleanupExpiredIdempotencyKeys,
} from "./service";
import { IdempotencyConflictError } from "./errors";
import { prisma } from "@/server/db";

describe("Server-Side Idempotency Safeguards Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("withIdempotency", () => {
    const key = "test-idem-key-100";
    const scope = "quota_reservation";

    it("executes the operation on initial call and persists completed result", async () => {
      // 1. Transaction returns null (no existing completed key, created as started)
      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "ik-1" }),
          },
        } as never);
      });

      const updateSpy = vi
        .spyOn(prisma.idempotencyKey, "update")
        .mockResolvedValueOnce({} as never);

      const operationFn = vi.fn().mockResolvedValue({ reservationId: "res-123" });

      const execResult = await withIdempotency(
        { key, scope },
        operationFn
      );

      expect(execResult.replayed).toBe(false);
      expect(execResult.result).toEqual({ reservationId: "res-123" });
      expect(operationFn).toHaveBeenCalledTimes(1);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { key_scope: { key, scope } },
        data: {
          status: "completed",
          responseBody: JSON.stringify({ reservationId: "res-123" }),
        },
      });
    });

    it("replays cached response without re-executing operation on identical retry", async () => {
      const existingCompleted = {
        id: "ik-2",
        key,
        scope,
        status: "completed",
        responseBody: JSON.stringify({ reservationId: "res-123" }),
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue(existingCompleted),
          },
        } as never);
      });

      const operationFn = vi.fn().mockResolvedValue({ reservationId: "new-res-456" });

      const execResult = await withIdempotency(
        { key, scope },
        operationFn
      );

      expect(execResult.replayed).toBe(true);
      expect(execResult.result).toEqual({ reservationId: "res-123" });
      // Critical check: the operation was NOT executed again
      expect(operationFn).not.toHaveBeenCalled();
    });

    it("throws IdempotencyConflictError when concurrent identical operation is already in progress", async () => {
      const activeStartedRecord = {
        id: "ik-3",
        key,
        scope,
        status: "started",
        responseBody: null,
        lockedAt: new Date(), // locked right now
        expiresAt: new Date(Date.now() + 86400000),
      };

      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue(activeStartedRecord),
          },
        } as never);
      });

      const operationFn = vi.fn();

      await expect(
        withIdempotency({ key, scope, lockTimeoutMs: 30000 }, operationFn)
      ).rejects.toThrow(IdempotencyConflictError);

      expect(operationFn).not.toHaveBeenCalled();
    });

    it("marks status as failed and rethrows error when operation fails", async () => {
      vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback) => {
        return callback({
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "ik-4" }),
          },
        } as never);
      });

      const updateSpy = vi
        .spyOn(prisma.idempotencyKey, "update")
        .mockResolvedValueOnce({} as never);

      const failingOp = vi.fn().mockRejectedValue(new Error("Downstream provider failed"));

      await expect(withIdempotency({ key, scope }, failingOp)).rejects.toThrow(
        "Downstream provider failed"
      );

      expect(updateSpy).toHaveBeenCalledWith({
        where: { key_scope: { key, scope } },
        data: {
          status: "failed",
        },
      });
    });
  });

  describe("cleanupExpiredIdempotencyKeys", () => {
    it("deletes idempotency keys past expiration", async () => {
      const deleteSpy = vi
        .spyOn(prisma.idempotencyKey, "deleteMany")
        .mockResolvedValueOnce({ count: 7 });

      const count = await cleanupExpiredIdempotencyKeys();
      expect(count).toBe(7);
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

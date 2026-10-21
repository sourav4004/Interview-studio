// @vitest-environment node
import { describe, it, expect } from "vitest";
import { prisma } from "./db";

describe("Server Prisma Client Singleton", () => {
  it("provides an instantiated PrismaClient instance in server environments", () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma).toBe("object");
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
    expect(typeof prisma.$transaction).toBe("function");
  });

  it("exposes the approved Milestone 3A data models on the client", () => {
    // Better Auth models
    expect(prisma.user).toBeDefined();
    expect(prisma.session).toBeDefined();
    expect(prisma.account).toBeDefined();
    expect(prisma.verification).toBeDefined();

    // User consent models
    expect(prisma.userConsent).toBeDefined();
    expect(prisma.consentAuditLog).toBeDefined();

    // Interview history ownership model
    expect(prisma.interview).toBeDefined();
  });
});

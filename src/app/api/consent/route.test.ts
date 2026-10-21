// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import * as actorModule from "@/server/auth/actor";
import * as consentService from "@/server/consent/service";
import * as personalizationModule from "@/server/personalization";

vi.mock("@/server/auth/actor");
vi.mock("@/server/consent/service");
vi.mock("@/server/personalization");

describe("/api/consent Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/consent", () => {
    it("returns 401 when request is unauthenticated or guest", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: null,
        guestSessionId: "guest-123",
        isAuthenticated: false,
      });

      const req = new NextRequest("http://localhost:3000/api/consent");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toContain("Authentication required");
    });

    it("returns 200 with personalization disabled when candidate has not opted in", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: "user-123",
        guestSessionId: null,
        isAuthenticated: true,
      });

      vi.spyOn(consentService, "getUserConsent").mockResolvedValueOnce({
        ai_questions: true,
        ai_evaluation: true,
        resume_processing: false,
        saved_resume: false,
        personalization: false,
        noticeVersion: "1.0",
        updatedAt: new Date(),
      });

      vi.spyOn(personalizationModule, "getActivePersonalizationConsent").mockResolvedValueOnce({
        isGranted: false,
        grantedAt: null,
        noticeVersion: "1.0",
      });

      const req = new NextRequest("http://localhost:3000/api/consent");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.personalization).toBe(false);
      expect(json.data.consentGrantedAt).toBeNull();
      expect(json.data.eligibleReportCount).toBe(0);
      expect(json.data.requiredReportCount).toBe(3);
    });

    it("returns 200 with eligible report count when personalization consent is active", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: "user-123",
        guestSessionId: null,
        isAuthenticated: true,
      });

      const grantDate = new Date("2026-10-18T12:00:00Z");

      vi.spyOn(consentService, "getUserConsent").mockResolvedValueOnce({
        ai_questions: true,
        ai_evaluation: true,
        resume_processing: false,
        saved_resume: false,
        personalization: true,
        noticeVersion: "1.0",
        updatedAt: new Date(),
      });

      vi.spyOn(personalizationModule, "getActivePersonalizationConsent").mockResolvedValueOnce({
        isGranted: true,
        grantedAt: grantDate,
        noticeVersion: "1.0",
      });

      vi.spyOn(personalizationModule, "getEligibleReportsForPersonalization").mockResolvedValueOnce([
        { id: "rep-1", completedAt: new Date("2026-10-18T13:00:00Z") },
        { id: "rep-2", completedAt: new Date("2026-10-18T14:00:00Z") },
      ] as unknown as personalizationModule.ValidatedEligibleReport[]);

      const req = new NextRequest("http://localhost:3000/api/consent");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.personalization).toBe(true);
      expect(json.data.eligibleReportCount).toBe(2);
      expect(json.data.requiredReportCount).toBe(3);
    });
  });

  describe("POST /api/consent", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: null,
        guestSessionId: null,
        isAuthenticated: false,
      });

      const req = new NextRequest("http://localhost:3000/api/consent", {
        method: "POST",
        body: JSON.stringify({ purpose: "personalization", action: "grant" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("returns 400 when body fails schema validation", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: "user-123",
        guestSessionId: null,
        isAuthenticated: true,
      });

      const req = new NextRequest("http://localhost:3000/api/consent", {
        method: "POST",
        body: JSON.stringify({ purpose: "invalid_purpose", action: "grant" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("grants consent and logs audit record when action is 'grant'", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: "user-123",
        guestSessionId: null,
        isAuthenticated: true,
      });

      vi.spyOn(consentService, "grantConsent").mockResolvedValueOnce({
        ai_questions: true,
        ai_evaluation: true,
        resume_processing: false,
        saved_resume: false,
        personalization: true,
        noticeVersion: "1.0",
        updatedAt: new Date(),
      });

      const req = new NextRequest("http://localhost:3000/api/consent", {
        method: "POST",
        body: JSON.stringify({ purpose: "personalization", action: "grant" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(consentService.grantConsent).toHaveBeenCalledWith("user-123", ["personalization"]);
    });

    it("withdraws consent and triggers profile purge when action is 'withdraw'", async () => {
      vi.spyOn(actorModule, "resolveRequestActor").mockResolvedValueOnce({
        userId: "user-123",
        guestSessionId: null,
        isAuthenticated: true,
      });

      vi.spyOn(consentService, "withdrawConsent").mockResolvedValueOnce({
        ai_questions: true,
        ai_evaluation: true,
        resume_processing: false,
        saved_resume: false,
        personalization: false,
        noticeVersion: "1.0",
        updatedAt: new Date(),
      });

      const req = new NextRequest("http://localhost:3000/api/consent", {
        method: "POST",
        body: JSON.stringify({ purpose: "personalization", action: "withdraw" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(consentService.withdrawConsent).toHaveBeenCalledWith("user-123", ["personalization"]);
    });
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { POST as handleStatePost } from "./state/route";
import { POST as handleAnswersPost } from "./answers/route";
import * as roomService from "@/server/interviews/room-service";
import * as sessionModule from "@/server/auth/session";
import type { AuthenticatedSession } from "@/server/auth/session";
import type { InterviewRoomState } from "@/server/interviews/types";
import {
  InterviewAnswerLockedError,
  InterviewNotFoundError,
} from "@/server/interviews/errors";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/server/auth/session");
vi.mock("@/server/guest");
vi.mock("@/server/interviews/room-service");

describe("Interview Room API Routes", () => {
  const mockParams = Promise.resolve({ id: "int-123" });

  const mockUserSession: AuthenticatedSession = {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: "sess-1",
      userId: "user-1",
      token: "token-1",
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockRoomState: InterviewRoomState = {
    id: "int-123",
    userId: "user-1",
    guestSessionId: null,
    interviewType: "technical",
    status: "in_progress",
    role: "Backend Engineer",
    difficulty: "medium",
    durationMinutes: 10,
    questionCount: 5,
    companyName: null,
    isPracticeMode: false,
    currentQuestionIndex: 0,
    startedAt: new Date(),
    endedAt: null,
    lastPausedAt: null,
    totalPauseDurationSeconds: 0,
    elapsedSeconds: 30,
    remainingSeconds: 570,
    isExpired: false,
    questions: [
      {
        id: "q-1",
        orderIndex: 1,
        questionText: "What is an index in SQL?",
        category: "Databases",
        difficulty: "medium",
        source: "fallback",
        timeLimitSeconds: 120,
      },
    ],
    answers: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/interviews/[id]", () => {
    it("returns 401 Unauthorized when actor has neither session nor guest token", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123");
      const res = await GET(req, { params: mockParams });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 200 with room state when authorized via registered session", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(roomService.getInterviewRoomState).mockResolvedValue(mockRoomState);

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123");
      const res = await GET(req, { params: mockParams });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.interview.id).toBe("int-123");
      expect(json.interview.role).toBe("Backend Engineer");
    });

    it("returns 404 when interview does not exist", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(roomService.getInterviewRoomState).mockRejectedValue(
        new InterviewNotFoundError("int-123")
      );

      const req = new NextRequest("http://localhost:3000/api/interviews/int-123");
      const res = await GET(req, { params: mockParams });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("NotFound");
    });
  });

  describe("POST /api/interviews/[id]/state", () => {
    it("returns 400 on invalid state transition action", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);

      const req = new NextRequest(
        "http://localhost:3000/api/interviews/int-123/state",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "invalid-action-xyz" }),
        }
      );

      const res = await handleStatePost(req, { params: mockParams });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("ValidationError");
    });

    it("returns 200 on valid state transition", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(roomService.executeInterviewAction).mockResolvedValue({
        ...mockRoomState,
        status: "paused",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/interviews/int-123/state",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pause" }),
        }
      );

      const res = await handleStatePost(req, { params: mockParams });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.interview.status).toBe("paused");
    });
  });

  describe("POST /api/interviews/[id]/answers", () => {
    it("returns 400 on invalid answer payload", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);

      const req = new NextRequest(
        "http://localhost:3000/api/interviews/int-123/answers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: "" }), // missing questionId & transcript
        }
      );

      const res = await handleAnswersPost(req, { params: mockParams });
      expect(res.status).toBe(400);
    });

    it("returns 200 when submitting valid answer", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(roomService.submitQuestionAnswer).mockResolvedValue({
        ...mockRoomState,
        currentQuestionIndex: 1,
      });

      const req = new NextRequest(
        "http://localhost:3000/api/interviews/int-123/answers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: "q-1",
            transcript: "An index is a data structure...",
            inputMode: "speech",
          }),
        }
      );

      const res = await handleAnswersPost(req, { params: mockParams });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.interview.currentQuestionIndex).toBe(1);
    });

    it("returns 200 when skipping question with isSkip: true", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(roomService.skipQuestion).mockResolvedValue({
        ...mockRoomState,
        currentQuestionIndex: 1,
      });

      const req = new NextRequest(
        "http://localhost:3000/api/interviews/int-123/answers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: "q-1",
            isSkip: true,
          }),
        }
      );

      const res = await handleAnswersPost(req, { params: mockParams });
      expect(res.status).toBe(200);
      expect(roomService.skipQuestion).toHaveBeenCalledWith(
        expect.anything(),
        "int-123",
        "q-1",
        undefined
      );
    });

    it("returns 409 Conflict when attempting to edit a locked answer in Realistic Mode", async () => {
      vi.mocked(sessionModule.getCurrentSession).mockResolvedValue(mockUserSession);
      vi.mocked(roomService.submitQuestionAnswer).mockRejectedValue(
        new InterviewAnswerLockedError("q-1")
      );

      const req = new NextRequest(
        "http://localhost:3000/api/interviews/int-123/answers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: "q-1",
            transcript: "New modification attempt",
          }),
        }
      );

      const res = await handleAnswersPost(req, { params: mockParams });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe("AnswerLocked");
    });
  });
});

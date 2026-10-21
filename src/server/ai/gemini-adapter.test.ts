// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiProviderAdapter } from "./gemini-adapter";
import {
  AiQuotaExhaustedError,
  AiResponseValidationError,
} from "./errors";
import { QuestionGenerationRequest } from "./types";

const sampleRequest: QuestionGenerationRequest = {
  mode: "technical",
  role: "Full Stack Developer Intern",
  difficulty: "medium",
  questionCount: 3,
  durationMinutes: 10,
  companyName: "Acme Corp",
};

describe("GeminiProviderAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws AiProviderError if API key is not configured", async () => {
    const adapter = new GeminiProviderAdapter({ apiKey: "" });
    await expect(adapter.generateQuestions(sampleRequest)).rejects.toThrow(
      "Gemini API key is not configured"
    );
  });

  it("successfully parses valid structured JSON response from Gemini", async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  questions: [
                    {
                      questionText:
                        "Explain the concept of event bubbling in the browser DOM and how you can prevent it.",
                      category: "Frontend",
                      difficulty: "medium",
                      timeLimitSeconds: 120,
                    },
                    {
                      questionText:
                        "What is the difference between SQL and NoSQL databases, and when would you choose one over the other?",
                      category: "Backend",
                      difficulty: "medium",
                      timeLimitSeconds: 120,
                    },
                    {
                      questionText:
                        "How do you optimize React component rendering performance using hooks like useMemo and useCallback?",
                      category: "Frontend",
                      difficulty: "medium",
                      timeLimitSeconds: 120,
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 320,
        candidatesTokenCount: 190,
        totalTokenCount: 510,
      },
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const adapter = new GeminiProviderAdapter({
      apiKey: "secret-gemini-key-12345",
      model: "gemini-3.5-flash-lite",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const response = await adapter.generateQuestions(sampleRequest);

    expect(response.questions).toHaveLength(3);
    expect(response.questions[0].questionText).toContain("event bubbling");
    expect(response.modelIdentifier).toBe("gemini-3.5-flash-lite");
    expect(response.usageMetadata?.totalTokens).toBe(510);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify URL passed to fetch contains model
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("gemini-3.5-flash-lite");
  });

  it("strips markdown code blocks around JSON returned by Gemini", async () => {
    const jsonString = JSON.stringify({
      questions: [
        {
          questionText: "How do JavaScript Promises work internally in the event loop?",
          category: "JavaScript",
          difficulty: "medium",
        },
        {
          questionText: "Explain how database indexes improve query execution speed.",
          category: "Database",
          difficulty: "medium",
        },
        {
          questionText: "Describe a situation where REST APIs are preferred over GraphQL.",
          category: "Architecture",
          difficulty: "medium",
        },
      ],
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "```json\n" + jsonString + "\n```" }],
            },
          },
        ],
      }),
    });

    const adapter = new GeminiProviderAdapter({
      apiKey: "secret-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const response = await adapter.generateQuestions(sampleRequest);
    expect(response.questions).toHaveLength(3);
  });

  it("rejects duplicate questions in the generated response", async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  questions: [
                    {
                      questionText: "What is database indexing and how does B-Tree indexing work?",
                      category: "Database",
                      difficulty: "medium",
                    },
                    {
                      questionText: "What is database indexing and how does b tree indexing work?", // Duplicate!
                      category: "Database",
                      difficulty: "medium",
                    },
                    {
                      questionText: "How do you handle asynchronous operations in Node.js?",
                      category: "Backend",
                      difficulty: "medium",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const adapter = new GeminiProviderAdapter({
      apiKey: "secret-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(adapter.generateQuestions(sampleRequest)).rejects.toThrow(
      AiResponseValidationError
    );
  });

  it("rejects incomplete question sets", async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  questions: [
                    {
                      questionText: "Only one question provided when three were requested.",
                      category: "General",
                      difficulty: "medium",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const adapter = new GeminiProviderAdapter({
      apiKey: "secret-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(adapter.generateQuestions(sampleRequest)).rejects.toThrow(
      /Incomplete question count/i
    );
  });

  it("handles HTTP 429 quota exhaustion as non-retryable AiQuotaExhaustedError", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Quota exceeded" } }),
    });

    const adapter = new GeminiProviderAdapter({
      apiKey: "secret-key",
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 2,
    });

    await expect(adapter.generateQuestions(sampleRequest)).rejects.toThrow(
      AiQuotaExhaustedError
    );
    expect(mockFetch).toHaveBeenCalledTimes(1); // Non-retryable, aborts immediately
  });

  it("retries on transient HTTP 500 error and succeeds on second attempt", async () => {
    const validJson = JSON.stringify({
      questions: [
        {
          questionText: "First valid technical question for this test candidate?",
          category: "General",
          difficulty: "medium",
        },
        {
          questionText: "Second valid technical question for this test candidate?",
          category: "General",
          difficulty: "medium",
        },
        {
          questionText: "Third valid technical question for this test candidate?",
          category: "General",
          difficulty: "medium",
        },
      ],
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: "Service Unavailable" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: validJson }] } }],
        }),
      });

    const adapter = new GeminiProviderAdapter({
      apiKey: "secret-key",
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 2,
    });

    const response = await adapter.generateQuestions(sampleRequest);
    expect(response.questions).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("never reflects API keys in error messages", async () => {
    const testSecret = "super-confidential-api-key-99999";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: `Invalid key ${testSecret} provided for operation`,
        },
      }),
    });

    const adapter = new GeminiProviderAdapter({
      apiKey: testSecret,
      fetchFn: mockFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    try {
      await adapter.generateQuestions(sampleRequest);
      expect.unreachable("Should have thrown");
    } catch (error: unknown) {
      expect((error as Error).message).not.toContain(testSecret);
      expect((error as Error).message).toContain("[REDACTED_API_KEY]");
    }
  });
});

import { describe, it, expect } from "vitest";
import { validateEnv } from "./env";

describe("Server-Side Environment Validation", () => {
  it("successfully validates minimal valid configuration and applies defaults", () => {
    const rawEnv = {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };

    const validated = validateEnv(rawEnv);
    expect(validated.NODE_ENV).toBe("development");
    expect(validated.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("fails clearly when NEXT_PUBLIC_APP_URL is not a valid URL", () => {
    const rawEnv = {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "not-a-valid-url",
    };

    expect(() => validateEnv(rawEnv)).toThrowError(
      /Environment validation failed/
    );
  });

  it("does not leak secret values in error messages upon validation failure", () => {
    const sensitiveSecretValue = "super-secret-token-value-12345";
    const rawEnv = {
      NODE_ENV: "invalid-env" as "development",
      BETTER_AUTH_SECRET: sensitiveSecretValue,
    };

    try {
      validateEnv(rawEnv);
      expect.fail("Validation should have thrown an error");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Environment validation failed");
      expect(message).toContain("NODE_ENV");
      // Critical privacy/security check: secret value must NOT be present in error message
      expect(message).not.toContain(sensitiveSecretValue);
    }
  });

  it("validates PostgreSQL connection strings for DATABASE_URL and DIRECT_URL without leaking credentials", () => {
    // Valid pooled and direct strings
    const validEnv = {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:pass@ep-cool-pooler.neon.tech/neondb?sslmode=require",
      DIRECT_URL: "postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=require",
    };
    const validated = validateEnv(validEnv);
    expect(validated.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(validated.DIRECT_URL).toBe(validEnv.DIRECT_URL);

    // Invalid protocol
    const invalidSecretPass = "secretPassword123";
    const invalidEnv = {
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DATABASE_URL: `mysql://admin:${invalidSecretPass}@localhost:3306/db`,
    };

    try {
      validateEnv(invalidEnv);
      expect.fail("Validation should fail for non-postgres protocol");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("Must be a valid PostgreSQL connection string");
      // Must not leak the credentials in the error
      expect(message).not.toContain(invalidSecretPass);
    }
  });

  it("accepts optional future module configuration when valid", () => {
    const rawEnv = {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://interview-app.example.com",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
      BETTER_AUTH_SECRET: "a-secure-secret-that-is-at-least-16-chars",
      GEMINI_API_KEY: "mock-gemini-key",
    };

    const validated = validateEnv(rawEnv);
    expect(validated.NODE_ENV).toBe("production");
    expect(validated.DATABASE_URL).toBe(
      "postgresql://user:pass@localhost:5432/db"
    );
    expect(validated.BETTER_AUTH_SECRET).toBe(
      "a-secure-secret-that-is-at-least-16-chars"
    );
    expect(validated.GEMINI_API_KEY).toBe("mock-gemini-key");
  });
});

import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .refine(
    (val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
    {
      message:
        "Must be a valid PostgreSQL connection string starting with postgresql:// or postgres://",
    }
  );

/**
 * Server-side environment schema.
 * Secret keys and sensitive infrastructure configurations live here.
 * Never expose these through client-facing code or NEXT_PUBLIC_ prefixes.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: postgresUrlSchema.optional(),
  DIRECT_URL: postgresUrlSchema.optional(),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
});

/**
 * Client-side environment schema.
 * Only non-sensitive variables prefixed with NEXT_PUBLIC_ are permitted here.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

/**
 * Combined environment schema.
 */
export const envSchema = serverSchema.merge(clientSchema);
export type Env = z.infer<typeof envSchema>;

/**
 * Validates the provided environment variables against the schema.
 * Formats errors safely by recording variable names and issue descriptions
 * without logging or leaking raw secret values.
 */
export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env
): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const safeErrorList = result.error.issues.map((issue) => {
      const field = issue.path.join(".");
      // Safely output only the field name and rule description; never reveal raw values
      return `  - ${field}: ${issue.message}`;
    });

    const errorMessage = [
      "Environment validation failed. Check your environment variables:",
      ...safeErrorList,
    ].join("\n");

    throw new Error(errorMessage);
  }

  return result.data;
}

/**
 * Validated environment object.
 * Evaluated safely at runtime.
 */
export const env = validateEnv();

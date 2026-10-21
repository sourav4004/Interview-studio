/**
 * Cryptographic helpers for guest session tokens.
 *
 * Enforces requirement:
 * "Do not store raw guest session secrets in the database;
 * use secure, opaque, expiring session identifiers with hashed server-side storage."
 */

import crypto from "crypto";

/**
 * Generates a cryptographically strong, opaque guest session token.
 */
export function generateGuestToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes a deterministic SHA-256 hash of a guest session token for secure database storage.
 * The raw token cannot be reconstructed from this hash.
 */
export function hashGuestToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

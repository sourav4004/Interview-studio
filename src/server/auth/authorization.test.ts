// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  assertUserOwnership,
  assertResourceAccess,
  AuthorizationError,
} from "./authorization";

describe("Server-Side Authorization & Resource Ownership Enforcement", () => {
  describe("assertUserOwnership", () => {
    it("allows access when authenticated user strictly matches resource owner", () => {
      expect(() =>
        assertUserOwnership("user-100", "user-100")
      ).not.toThrow();
    });

    it("rejects access and throws AuthorizationError when user IDs do not match", () => {
      expect(() =>
        assertUserOwnership("user-100", "user-200")
      ).toThrow(AuthorizationError);
    });

    it("rejects access when either actor or owner is missing", () => {
      expect(() => assertUserOwnership("", "user-100")).toThrow(
        AuthorizationError
      );
      expect(() => assertUserOwnership("user-100", "")).toThrow(
        AuthorizationError
      );
    });
  });

  describe("assertResourceAccess", () => {
    it("allows registered user access to their own resource", () => {
      expect(() =>
        assertResourceAccess(
          { userId: "user-abc" },
          { userId: "user-abc" }
        )
      ).not.toThrow();
    });

    it("blocks registered user access to another user's resource", () => {
      expect(() =>
        assertResourceAccess(
          { userId: "user-attacker" },
          { userId: "user-victim" }
        )
      ).toThrow(AuthorizationError);
    });

    it("allows guest session access to their own temporary resource", () => {
      expect(() =>
        assertResourceAccess(
          { guestSessionId: "guest-xyz" },
          { guestSessionId: "guest-xyz" }
        )
      ).not.toThrow();
    });

    it("blocks guest session access to another guest session's resource", () => {
      expect(() =>
        assertResourceAccess(
          { guestSessionId: "guest-1" },
          { guestSessionId: "guest-2" }
        )
      ).toThrow(AuthorizationError);
    });

    it("blocks access when resource has neither userId nor guestSessionId assigned (fail closed)", () => {
      expect(() =>
        assertResourceAccess(
          { userId: "user-1" },
          { userId: null, guestSessionId: null }
        )
      ).toThrow(AuthorizationError);
    });
  });
});

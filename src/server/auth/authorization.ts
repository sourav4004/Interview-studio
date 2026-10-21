/**
 * Server-Side Authorization & Resource Ownership Enforcement.
 *
 * Enforces rule from AGENTS.md and SECURITY_PRIVACY.md:
 * "Server-side authorization for every private resource.
 * Never rely on frontend-only controls."
 */

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized: You do not have permission to access this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Asserts that the authenticated user strictly owns the targeted private resource.
 */
export function assertUserOwnership(
  authenticatedUserId: string,
  resourceOwnerUserId: string
): void {
  if (!authenticatedUserId || !resourceOwnerUserId) {
    throw new AuthorizationError("Invalid actor or resource identity.");
  }

  if (authenticatedUserId !== resourceOwnerUserId) {
    throw new AuthorizationError(
      "Access Denied: You do not have permission to access or modify this resource."
    );
  }
}

export interface SecurityActor {
  userId?: string | null;
  guestSessionId?: string | null;
}

export interface ProtectedResource {
  userId?: string | null;
  guestSessionId?: string | null;
}

/**
 * Asserts that the calling actor (authenticated user or active guest) owns the protected resource.
 */
export function assertResourceAccess(
  actor: SecurityActor,
  resource: ProtectedResource
): void {
  // If resource is owned by a registered user:
  if (resource.userId) {
    if (!actor.userId || actor.userId !== resource.userId) {
      throw new AuthorizationError("Resource is owned by a different registered user.");
    }
    return;
  }

  // If resource is owned by a guest session:
  if (resource.guestSessionId) {
    if (!actor.guestSessionId || actor.guestSessionId !== resource.guestSessionId) {
      throw new AuthorizationError("Resource is owned by a different guest session.");
    }
    return;
  }

  // If resource has no owner defined, access is denied by default (least privilege)
  throw new AuthorizationError("Resource lacks an ownership attribution.");
}

import { cookies } from "next/headers";
import { signSession, verifySession, SessionPayload } from "./session";

export const SESSION_COOKIE_NAME = "session_token";

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }
  return user;
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Tenant authorization guard.
 * Strictly asserts that a target resource belongs to the authenticated user's household.
 */
export function assertHouseholdAccess(
  userHouseholdId: string,
  targetHouseholdId: string
): void {
  if (!userHouseholdId || !targetHouseholdId || userHouseholdId !== targetHouseholdId) {
    throw new Error("FORBIDDEN: Access denied. Cannot access resources outside your household.");
  }
}

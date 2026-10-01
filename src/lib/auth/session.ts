import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: string;
  householdId: string;
  email: string;
  name: string;
}

const DEFAULT_SECRET = "default-fallback-secret-minimum-32-chars-long-for-dev";
const SECRET_KEY = new TextEncoder().encode(process.env.AUTH_SECRET || DEFAULT_SECRET);
const SESSION_EXPIRATION = "7d";

/**
 * Sign an encrypted/signed JWT session token
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .sign(SECRET_KEY);
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.householdId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      householdId: payload.householdId,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "tm_session";
export const SESSION_DAYS = 14;

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

function secretKey() {
  const secret =
    process.env.AUTH_SECRET?.trim() ||
    process.env.TM_API_KEY?.trim() ||
    "territory-monitor-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

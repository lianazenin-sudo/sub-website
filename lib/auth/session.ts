import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { z } from "zod";

export const SESSION_COOKIE = "trace_session";

export const authSessionSchema = z.object({
  provider: z.enum(["google", "email"]),
  email: z.string().email(),
  name: z.string().optional(),
  username: z.string().optional(),
  picture: z.string().url().optional().or(z.literal("")),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-trace-session-secret";
  }

  throw new Error("AUTH_SESSION_SECRET is not configured");
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function encodeSession(session: AuthSession): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function decodeSession(token: string): AuthSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    return authSessionSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function clearAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

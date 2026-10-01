import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthSession,
  setAuthSession,
} from "@/lib/auth/session";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-zA-Z0-9._]+$/),
});

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { username } = bodySchema.parse(await request.json());

    await setAuthSession({
      ...session,
      username,
    });

    return NextResponse.json({ username });
  } catch {
    return NextResponse.json(
      { error: "Unable to save username" },
      { status: 400 },
    );
  }
}

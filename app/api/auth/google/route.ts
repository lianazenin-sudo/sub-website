import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthSession } from "@/lib/auth/session";

const bodySchema = z.object({
  accessToken: z.string().min(1),
});

const googleUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  email_verified: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());

    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${body.accessToken}` },
        cache: "no-store",
      },
    );

    if (!googleResponse.ok) {
      return NextResponse.json(
        { error: "Unable to verify Google account" },
        { status: 401 },
      );
    }

    const profile = googleUserSchema.parse(await googleResponse.json());

    if (profile.email_verified === false) {
      return NextResponse.json(
        { error: "Google email is not verified" },
        { status: 401 },
      );
    }

    await setAuthSession({
      provider: "google",
      email: profile.email,
      name: profile.name,
      picture: profile.picture ?? "",
    });

    return NextResponse.json({
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Google sign-in failed. Please try again." },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/email";

const bodySchema = z.object({
  email: emailSchema,
  website: z.string().optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  // Honeypot: pretend it worked and do not forward the address.
  if (parsed.data.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "Waitlist is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: parsed.data.email,
        source: "landing-page-waitlist",
        submittedAt: new Date().toISOString(),
      }),
    });

    // Make.com answers with plain text ("Accepted"), not JSON.
    await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "Something went wrong, please try again" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong, please try again" },
      { status: 502 },
    );
  }
}

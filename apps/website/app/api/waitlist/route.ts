import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/email";
import { releaseWaitlistEmail, reserveWaitlistEmail } from "@/lib/waitlist-store";

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

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromEmail = fromAddress.match(/<([^>]+)>/)?.[1]?.trim() || fromAddress.trim();
  const from = `Trace <${fromEmail}>`;
  const to = process.env.WAITLIST_TO_EMAIL;
  if (!apiKey || !to) {
    return NextResponse.json(
      { ok: false, error: "Waitlist is not configured" },
      { status: 500 },
    );
  }

  const email = parsed.data.email;
  if (reserveWaitlistEmail(email) === "duplicate") {
    return NextResponse.json(
      { ok: false, error: "This email is already in our waitlist" },
      { status: 409 },
    );
  }

  const resend = new Resend(apiKey);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await resend.emails.send({
        from,
        to: [to],
        template: {
          id: "waitlist-confirmation",
        },
      });

      if (!error) {
        return NextResponse.json({ ok: true });
      }

      console.error("Resend waitlist error", error);
    }

    releaseWaitlistEmail(email);
    return NextResponse.json(
      { ok: false, error: "Something went wrong, please try again" },
      { status: 502 },
    );
  } catch {
    releaseWaitlistEmail(email);
    return NextResponse.json(
      { ok: false, error: "Something went wrong, please try again" },
      { status: 502 },
    );
  }
}

import { after, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/email";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { releaseWaitlistEmail, reserveWaitlistEmail } from "@/lib/waitlist-store";

const bodySchema = z.object({
  email: emailSchema,
  source: z.string().trim().max(40).optional(),
  website: z.string().optional(),
});

const failed = () =>
  NextResponse.json(
    { ok: false, error: "Something went wrong, please try again" },
    { status: 502 },
  );

/** Forwards the signup to the Make.com scenario that records waitlist emails. */
async function sendToWebhook(webhookUrl: string, email: string, source: string) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      source,
      to: process.env.WAITLIST_TO_EMAIL,
      submittedAt: new Date().toISOString(),
    }),
  });
  // Make.com answers with plain text ("Accepted"), not JSON.
  await response.text();
  return response.ok;
}

/** Emails the signup address to the waitlist inbox. */
async function sendNotification(apiKey: string, to: string, email: string, source: string) {
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromEmail = fromAddress.match(/<([^>]+)>/)?.[1]?.trim() || fromAddress.trim();
  const resend = new Resend(apiKey);

  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await resend.emails.send({
      from: `Trace <${fromEmail}>`,
      to: [to],
      replyTo: email,
      subject: `New waitlist signup: ${email}`,
      text: `${email} joined the Trace waitlist.\n\nSource: ${source}\nDate: ${new Date().toISOString()}`,
    });
    if (!error) return true;
    console.error("Resend waitlist error", error);
  }
  return false;
}

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

  const email = parsed.data.email.toLowerCase();
  const source = parsed.data.source || "landing-waitlist";
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.WAITLIST_TO_EMAIL;
  const hasRemote = Boolean(webhookUrl || (apiKey && to));

  // Supabase is the system of record when configured: the signup succeeds only
  // once the row is inserted. Webhook and inbox alerts then run after the response.
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("waitlist_signups").insert({ email, source });
    if (error?.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "This email is already in our waitlist" },
        { status: 409 },
      );
    }
    if (error) {
      console.error("Supabase waitlist insert error", error);
      return failed();
    }

    after(async () => {
      const results = await Promise.allSettled([
        webhookUrl ? sendToWebhook(webhookUrl, email, source) : Promise.resolve(true),
        apiKey && to ? sendNotification(apiKey, to, email, source) : Promise.resolve(true),
      ]);
      for (const result of results) {
        if (result.status === "rejected" || !result.value) {
          console.error("Waitlist notification failed", result.status === "rejected" ? result.reason : "");
        }
      }
    });
    return NextResponse.json({ ok: true });
  }

  // Local SQLite record. Also used to reject duplicates. It is not writable on
  // serverless hosts, so a failure here only matters when nothing else is set up.
  let storedLocally = false;
  try {
    if ((await reserveWaitlistEmail(email)) === "duplicate") {
      return NextResponse.json(
        { ok: false, error: "This email is already in our waitlist" },
        { status: 409 },
      );
    }
    storedLocally = true;
  } catch (error) {
    console.error("Waitlist local store error", error);
  }

  if (!hasRemote) {
    if (storedLocally) return NextResponse.json({ ok: true });
    console.error("Waitlist is not configured: set MAKE_WEBHOOK_URL or RESEND_API_KEY + WAITLIST_TO_EMAIL");
    return NextResponse.json(
      { ok: false, error: "Waitlist is not available right now, please try again later" },
      { status: 500 },
    );
  }

  // The signup only counts once it reached a remote destination, so an address
  // is never reported as saved while sitting only on a temporary disk.
  const results = await Promise.allSettled([
    webhookUrl ? sendToWebhook(webhookUrl, email, source) : Promise.resolve(false),
    apiKey && to ? sendNotification(apiKey, to, email, source) : Promise.resolve(false),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("Waitlist delivery error", result.reason);
  }
  const delivered = results.some((result) => result.status === "fulfilled" && result.value);
  if (webhookUrl && !(results[0].status === "fulfilled" && results[0].value)) {
    console.error("Waitlist webhook did not accept the signup");
  }

  if (!delivered) {
    if (storedLocally) {
      try {
        await releaseWaitlistEmail(email);
      } catch (error) {
        console.error("Waitlist local store error", error);
      }
    }
    return failed();
  }

  return NextResponse.json({ ok: true });
}

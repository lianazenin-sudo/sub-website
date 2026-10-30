import { after, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/email";
import { contactSubjects } from "@/lib/contact-form";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  subject: z.enum(contactSubjects),
  message: z.string().trim().min(10).max(4000),
  website: z.string().optional(),
});

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const hits = new Map<string, number[]>();

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function allow(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  if (!allow(clientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "Too many messages. Please try again later." },
      { status: 429 },
    );
  }

  const { name, email, subject, message } = parsed.data;
  const webhookUrl = process.env.MAKE_CONTACT_WEBHOOK_URL;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;

  // Supabase is the system of record when configured: the message counts as sent
  // once the row is saved, and the inbox email / webhook then run after the response.
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from("contact_messages")
      .insert({ name, email, subject, message });
    if (!error) {
      after(async () => {
        const results = await Promise.allSettled([
          apiKey && to ? sendEmail(apiKey, to, parsed.data) : Promise.resolve(true),
          webhookUrl ? sendToWebhook(webhookUrl, to, parsed.data) : Promise.resolve(true),
        ]);
        for (const result of results) {
          if (result.status === "rejected" || !result.value) {
            console.error("Contact notification failed", result.status === "rejected" ? result.reason : "");
          }
        }
      });
      return NextResponse.json({ ok: true });
    }
    console.error("Supabase contact insert error", error);
  }

  // Without a saved row, the message only counts as sent if it reached the inbox or webhook.
  const hasDelivery = Boolean((apiKey && to) || webhookUrl);
  if (!hasDelivery) {
    console.error("Contact form is not configured: set Supabase, RESEND_API_KEY + CONTACT_TO_EMAIL, or MAKE_CONTACT_WEBHOOK_URL");
    return NextResponse.json(
      { ok: false, error: "Something went wrong, please try again" },
      { status: supabase ? 502 : 500 },
    );
  }

  const results = await Promise.allSettled([
    apiKey && to ? sendEmail(apiKey, to, parsed.data) : Promise.resolve(false),
    webhookUrl ? sendToWebhook(webhookUrl, to, parsed.data) : Promise.resolve(false),
  ]);
  if (results.some((result) => result.status === "fulfilled" && result.value)) {
    return NextResponse.json({ ok: true });
  }
  for (const result of results) {
    if (result.status === "rejected") console.error("Contact delivery error", result.reason);
  }
  return NextResponse.json(
    { ok: false, error: "Something went wrong, please try again" },
    { status: 502 },
  );
}

type ContactMessage = z.infer<typeof bodySchema>;

/** Emails the message to the contact inbox; replying answers the sender directly. */
async function sendEmail(apiKey: string, to: string, data: ContactMessage) {
  const fromAddress = process.env.RESEND_FROM_EMAIL || "support@jointraceapp.com";
  const fromEmail = fromAddress.match(/<([^>]+)>/)?.[1]?.trim() || fromAddress.trim();
  const { error } = await new Resend(apiKey).emails.send({
    from: `Trace <${fromEmail}>`,
    to: [to],
    replyTo: data.email,
    subject: `Contact form: ${data.subject} — ${data.name}`,
    text: `From: ${data.name} <${data.email}>\nSubject: ${data.subject}\n\n${data.message}`,
  });
  if (error) console.error("Resend contact error", error);
  return !error;
}

async function sendToWebhook(webhookUrl: string, to: string | undefined, data: ContactMessage) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      to,
      source: "contact-page-form",
      submittedAt: new Date().toISOString(),
    }),
  });
  // Make.com answers with plain text ("Accepted"), not JSON.
  await response.text();
  return response.ok;
}

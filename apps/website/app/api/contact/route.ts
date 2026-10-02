import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/email";
import { contactSubjects } from "@/lib/contact-form";

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

  const webhookUrl = process.env.MAKE_CONTACT_WEBHOOK_URL;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!webhookUrl || !to) {
    return NextResponse.json(
      { ok: false, error: "Contact form is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
        to,
        source: "contact-page-form",
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

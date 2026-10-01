import { NextResponse } from "next/server";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/email";
import { setAuthSession } from "@/lib/auth/session";

const bodySchema = z.object({
  email: emailSchema,
});

export async function POST(request: Request) {
  try {
    const { email } = bodySchema.parse(await request.json());

    await setAuthSession({
      provider: "email",
      email,
    });

    return NextResponse.json({ email });
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { createFixtureScanningJob } from "@/lib/scanning/fixture-store";

const bodySchema = z.object({
  variant: z.enum(["progress", "completed", "failed"]).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.email ?? "anonymous";

  let variant: "progress" | "completed" | "failed" = "progress";
  try {
    const body = bodySchema.parse(await request.json());
    variant = body.variant ?? "progress";
  } catch {
    // Empty body is fine for Phase 1.
  }

  const job = createFixtureScanningJob({
    userId,
    variant,
  });

  return NextResponse.json(job, { status: 201 });
}

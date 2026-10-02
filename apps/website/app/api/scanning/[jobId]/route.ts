import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import {
  createFixtureScanningJob,
  getFixtureScanningJob,
} from "@/lib/scanning/fixture-store";
import { scanningJobSchema } from "@/lib/scanning/types";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const session = await getAuthSession();
  const userId = session?.email ?? "anonymous";

  let job = getFixtureScanningJob(jobId);

  // Phase 1: seed a fixture job on first read so the UI can render.
  // Later phases replace this with a real scanning job from the database.
  if (!job) {
    const variant =
      jobId.endsWith("-complete") || jobId === "demo-complete"
        ? "completed"
        : jobId.endsWith("-failed") || jobId === "demo-failed"
          ? "failed"
          : "progress";

    job = createFixtureScanningJob({
      id: jobId,
      userId,
      variant,
    });
  }

  return NextResponse.json(scanningJobSchema.parse(job));
}

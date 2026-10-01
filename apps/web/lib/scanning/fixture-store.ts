import type { ScanningJob } from "@/lib/scanning/types";

/**
 * In-memory Phase 1 fixture store.
 * Replaced by a real database-backed scanning service in later phases.
 * Does NOT animate fake progress — returns the stored job as-is.
 */
const jobs = new Map<string, ScanningJob>();

export function getFixtureScanningJob(jobId: string): ScanningJob | null {
  return jobs.get(jobId) ?? null;
}

export function upsertFixtureScanningJob(job: ScanningJob): ScanningJob {
  jobs.set(job.id, job);
  return job;
}

export function createFixtureScanningJob(input: {
  id?: string;
  userId: string;
  variant?: "progress" | "completed" | "failed";
}): ScanningJob {
  const id = input.id ?? `scan_${Date.now()}`;
  const now = new Date().toISOString();
  const variant = input.variant ?? "progress";

  if (variant === "completed") {
    return upsertFixtureScanningJob({
      id,
      userId: input.userId,
      status: "completed",
      currentStep: null,
      progress: 100,
      emailsScanned: 342,
      relevantEmailsFound: 47,
      subscriptionsFound: 12,
      startedAt: now,
      completedAt: now,
      error: null,
    });
  }

  if (variant === "failed") {
    return upsertFixtureScanningJob({
      id,
      userId: input.userId,
      status: "failed",
      currentStep: "identifying_subscriptions",
      progress: 42,
      emailsScanned: 120,
      relevantEmailsFound: 18,
      subscriptionsFound: 0,
      startedAt: now,
      completedAt: null,
      error: "Something went wrong while scanning your inbox.",
    });
  }

  // Mid-scan fixture matching the Figma progress screen structure.
  return upsertFixtureScanningJob({
    id,
    userId: input.userId,
    status: "processing",
    currentStep: "identifying_subscriptions",
    progress: 58,
    emailsScanned: 342,
    relevantEmailsFound: 47,
    subscriptionsFound: 12,
    startedAt: now,
    completedAt: null,
    error: null,
  });
}

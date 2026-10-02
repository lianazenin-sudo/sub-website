import type {
  ScanningChecklistItem,
  ScanningJob,
  ScanningJobStatus,
  ScanningStepId,
  ScanningStepVisualState,
} from "./types";

export const SCANNING_STEPS: readonly {
  id: ScanningStepId;
  label: string;
}[] = [
  { id: "connecting_to_gmail", label: "Connecting to Gmail" },
  { id: "finding_subscription_emails", label: "Finding subscription emails" },
  { id: "identifying_subscriptions", label: "Identifying subscriptions" },
  { id: "checking_renewal_dates", label: "Checking renewal dates" },
  { id: "organizing_everything", label: "Organizing everything" },
] as const;

const STATUS_TO_STEP: Partial<Record<ScanningJobStatus, ScanningStepId>> = {
  connecting: "connecting_to_gmail",
  scanning: "finding_subscription_emails",
  processing: "identifying_subscriptions",
  extracting: "checking_renewal_dates",
  organizing: "organizing_everything",
};

export function resolveCurrentStep(job: ScanningJob): ScanningStepId | null {
  if (job.status === "completed" || job.status === "failed") {
    return null;
  }

  return job.currentStep ?? STATUS_TO_STEP[job.status] ?? null;
}

function stepVisualState(
  stepId: ScanningStepId,
  currentStep: ScanningStepId | null,
  status: ScanningJobStatus,
): ScanningStepVisualState {
  if (status === "completed") {
    return "completed";
  }

  if (status === "failed" || status === "pending" || !currentStep) {
    return "pending";
  }

  const currentIndex = SCANNING_STEPS.findIndex((step) => step.id === currentStep);
  const stepIndex = SCANNING_STEPS.findIndex((step) => step.id === stepId);

  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

export function buildScanningChecklist(job: ScanningJob): ScanningChecklistItem[] {
  const currentStep = resolveCurrentStep(job);

  const steps: ScanningChecklistItem[] = SCANNING_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    state: stepVisualState(step.id, currentStep, job.status),
  }));

  const stats: ScanningChecklistItem[] = [];

  if (job.emailsScanned > 0) {
    stats.push({
      id: "emails_scanned",
      label: `${job.emailsScanned} emails scanned`,
      state: "completed",
    });
  }

  if (job.relevantEmailsFound > 0) {
    stats.push({
      id: "relevant_emails",
      label: `${job.relevantEmailsFound} subscription-related`,
      state: "completed",
    });
  }

  if (job.subscriptionsFound > 0) {
    stats.push({
      id: "subscriptions_identified",
      label: `${job.subscriptionsFound} subscriptions identified`,
      state: "completed",
    });
  }

  return [...steps, ...stats];
}

export function displayNameFromSession(input: {
  name?: string | null;
  email?: string | null;
  username?: string | null;
}): string {
  if (input.username?.trim()) return input.username.trim();
  if (input.name?.trim()) {
    return input.name.trim().split(/\s+/)[0] ?? input.name.trim();
  }
  if (input.email?.trim()) {
    return input.email.trim().split("@")[0] ?? "there";
  }
  return "there";
}

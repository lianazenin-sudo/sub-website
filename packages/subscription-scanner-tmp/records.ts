/**
 * Small builders shared by the processing, sync and rebuild steps, so every
 * place creates review items, log entries and identities the same way.
 */
import { reviewItemIdFor } from "../dedup/identity";
import type {
  PipelineStage,
  ProcessingLogEntry,
  ReviewItem,
  ReviewReason,
  SubscriptionIdentity,
  SubscriptionRecord,
} from "../domain/types";
import type { ReviewFinding } from "../state/project";

/** Builds a processing-log entry. Never put email bodies in `details`. */
export function logEntry(
  accountId: string,
  emailId: string | null,
  level: ProcessingLogEntry["level"],
  stage: PipelineStage,
  message: string,
  details: Record<string, unknown>,
  createdAt: Date,
): ProcessingLogEntry {
  return { accountId, emailId, level, stage, message, details, createdAt };
}

/**
 * Builds an open review item. The id depends only on the source (event or
 * email) and the reason, so the same problem never creates two items.
 */
export function reviewItem(params: {
  accountId: string;
  emailId: string;
  eventId: string | null;
  subscriptionId: string | null;
  reason: ReviewReason;
  details: Record<string, unknown>;
  createdAt: Date;
}): ReviewItem {
  return {
    id: reviewItemIdFor(params.eventId ?? params.emailId, params.reason),
    accountId: params.accountId,
    emailId: params.emailId,
    eventId: params.eventId,
    subscriptionId: params.subscriptionId,
    reason: params.reason,
    details: params.details,
    status: "open",
    createdAt: params.createdAt,
  };
}

/** Converts findings from a projection into review items for a subscription. */
export function reviewItemsFromFindings(
  findings: readonly ReviewFinding[],
  accountId: string,
  subscriptionId: string,
  createdAt: Date,
): ReviewItem[] {
  return findings.map((f) =>
    reviewItem({
      accountId,
      emailId: f.emailId,
      eventId: f.eventId,
      subscriptionId,
      reason: f.reason,
      details: f.details,
      createdAt,
    }),
  );
}

/** Extracts the fixed identity fields from a stored subscription. */
export function identityOf(record: SubscriptionRecord): SubscriptionIdentity {
  return {
    id: record.id,
    accountId: record.accountId,
    providerKey: record.providerKey,
    createdFromEmailId: record.createdFromEmailId,
    createdAt: record.createdAt,
  };
}

/** Returns the values without duplicates, keeping first-seen order. */
export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Turns anything thrown into a short, single-line message safe to store. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 500);
}

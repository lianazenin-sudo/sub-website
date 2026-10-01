/**
 * Domain types shared by every stage of the pipeline.
 *
 * Conventions:
 * - Calendar days (renewal date, trial end…) are ISO strings "YYYY-MM-DD"
 *   (`DateOnly`), never Date objects, so they can't shift by a day when moved
 *   between time zones. Moments in time (when an email arrived) are Dates.
 * - Money is an integer in the currency's minor unit (cents) plus an ISO 4217
 *   code, so prices are never floating-point numbers.
 */
import { z } from "zod";

/** A calendar day in ISO format, e.g. "2026-10-15". */
export type DateOnly = string;

/** What a subscription-related email says happened. One email → one event. */
export const SUBSCRIPTION_EVENT_TYPES = [
  "subscription_started",
  "trial_started",
  "trial_ending",
  "renewal_reminder",
  "payment_succeeded",
  "payment_failed",
  "plan_changed",
  "price_changed",
  "cancelled",
  "expiring",
  "expired",
] as const;
export type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "expired",
  "unknown",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

/** Why something was sent to the review queue instead of being trusted. */
export const REVIEW_REASONS = [
  "low_classification_confidence",
  "ambiguous_event_type",
  "ambiguous_price",
  "ambiguous_date",
  "ambiguous_match",
  "unresolved_merchant",
  "currency_conflict",
  "activity_after_cancellation",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MoneySchema = z.object({
  amountMinor: z.number().int().min(0).max(10_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type Money = z.infer<typeof MoneySchema>;

/**
 * Everything the extractor managed to read from one email. Validated with Zod
 * because it is derived from untrusted email text; the same schema is used
 * when reading the stored JSON back from the database.
 */
export const ExtractedSubscriptionDataSchema = z.object({
  providerKey: z.string().min(1).max(100),
  providerName: z.string().min(1).max(120),
  billedVia: z.string().max(120).nullable(),
  planName: z.string().max(80).nullable(),
  price: MoneySchema.nullable(),
  previousPrice: MoneySchema.nullable(),
  billingFrequency: z.enum(BILLING_FREQUENCIES).nullable(),
  startDate: DateOnlySchema.nullable(),
  renewalDate: DateOnlySchema.nullable(),
  expirationDate: DateOnlySchema.nullable(),
  cancellationDate: DateOnlySchema.nullable(),
  trialEndDate: DateOnlySchema.nullable(),
  paymentDate: DateOnlySchema.nullable(),
  isTrial: z.boolean(),
});
export type ExtractedSubscriptionData = z.infer<
  typeof ExtractedSubscriptionDataSchema
>;

/** Provider-agnostic email after cleanup. Bodies are never persisted. */
export interface NormalizedEmail {
  /** Internal, deterministic id (see dedup/identity.ts). */
  id: string;
  accountId: string;
  provider: string;
  providerMessageId: string;
  /** RFC 5322 Message-ID header, normalized; null if the email had none. */
  internetMessageId: string | null;
  /** Content hash used to spot the same email arriving under different ids. */
  fingerprint: string;
  receivedAt: Date;
  from: { address: string; name: string | null; domain: string };
  subject: string;
  /** Plain-text body, whitespace-normalized and length-capped. */
  text: string;
  /** Provider labels/categories, e.g. Gmail's CATEGORY_PROMOTIONS. */
  labels: string[];
}

export interface ClassificationResult {
  decision: "accept" | "review" | "ignore";
  eventType: SubscriptionEventType | null;
  /** Final score after context bonuses and penalties. */
  score: number;
  /** Score of the winning event type's phrase matches alone. */
  eventScore: number;
  runnerUp: { eventType: SubscriptionEventType; score: number } | null;
  /** True when a conflicting event type scored almost as high as the winner. */
  ambiguous: boolean;
  /** Human-readable trail of what contributed to the score (for logs/debugging). */
  signals: string[];
}

export interface EmailAnalysis {
  classification: ClassificationResult;
  extracted: ExtractedSubscriptionData | null;
  reviewReasons: ReviewReason[];
}

/** One email's effect on a subscription. Events are the source of truth. */
export interface SubscriptionEvent {
  id: string;
  accountId: string;
  emailId: string;
  /** Null when the event could not be safely attached to a subscription. */
  subscriptionId: string | null;
  type: SubscriptionEventType;
  /** When the email was received; events are replayed in this order. */
  occurredAt: Date;
  data: ExtractedSubscriptionData;
  confidence: number;
  reviewReasons: ReviewReason[];
  createdAt: Date;
}

/** Fields of a subscription that are fully derived by replaying its events. */
export interface SubscriptionState {
  providerName: string;
  billedVia: string | null;
  planName: string | null;
  status: SubscriptionStatus;
  startDate: DateOnly | null;
  renewalDate: DateOnly | null;
  /** True when renewalDate was calculated (last payment + cycle), not stated. */
  renewalDateEstimated: boolean;
  expirationDate: DateOnly | null;
  cancellationDate: DateOnly | null;
  billingFrequency: BillingFrequency | null;
  price: Money | null;
  previousPrice: Money | null;
  isTrial: boolean;
  trialEndDate: DateOnly | null;
  lastPaymentDate: DateOnly | null;
  lastEmailId: string | null;
  lastEventAt: Date | null;
}

/** Fields fixed when the subscription is first created. */
export interface SubscriptionIdentity {
  id: string;
  accountId: string;
  providerKey: string;
  createdFromEmailId: string;
  createdAt: Date;
}

export type SubscriptionRecord = SubscriptionIdentity &
  SubscriptionState & { needsReview: boolean; updatedAt: Date };

export interface ReviewItem {
  /** Deterministic (email/event + reason) so re-runs never duplicate it. */
  id: string;
  accountId: string;
  emailId: string;
  eventId: string | null;
  subscriptionId: string | null;
  reason: ReviewReason;
  details: Record<string, unknown>;
  status: "open" | "resolved";
  createdAt: Date;
}

export type ProcessedEmailStatus =
  | "processed"
  | "ignored"
  | "needs_review"
  | "duplicate"
  | "failed";

/** Ledger entry: one row per email the engine has looked at. */
export interface ProcessedEmailRecord {
  id: string;
  accountId: string;
  provider: string;
  providerMessageId: string;
  internetMessageId: string | null;
  fingerprint: string | null;
  receivedAt: Date | null;
  fromAddress: string | null;
  subject: string | null;
  status: ProcessedEmailStatus;
  eventType: SubscriptionEventType | null;
  classificationScore: number | null;
  subscriptionId: string | null;
  eventId: string | null;
  duplicateOf: string | null;
  attempts: number;
  lastError: string | null;
  rulesVersion: string;
  processedAt: Date;
}

/** Which email created/updated which subscription, and what changed. */
export interface AuditEntry {
  id: string;
  accountId: string;
  subscriptionId: string;
  emailId: string;
  eventId: string;
  action: "created" | "updated" | "unchanged";
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: Date;
}

export type PipelineStage =
  | "collect"
  | "dedup"
  | "classify"
  | "extract"
  | "match"
  | "update"
  | "sync"
  | "rebuild";

export interface ProcessingLogEntry {
  accountId: string;
  emailId: string | null;
  level: "info" | "warn" | "error";
  stage: PipelineStage;
  message: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

/** Where a mailbox's sync left off, so scans can resume after a crash. */
export interface SyncState {
  accountId: string;
  phase: "initial" | "incremental";
  /** Provider change-stream position (Gmail: historyId). */
  checkpoint: string | null;
  scanSince: Date | null;
  scanPageToken: string | null;
  initialScanCompletedAt: Date | null;
  lastSyncedAt: Date | null;
}

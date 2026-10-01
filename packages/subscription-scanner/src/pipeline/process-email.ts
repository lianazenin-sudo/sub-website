/**
 * Processes ONE email through the whole pipeline:
 *
 *   Collector → Deduplication → Classifier → Extractor → Matcher → Database update → Audit/Log
 *
 * Reliability rules:
 *   - Network work (fetching the message) and pure analysis happen BEFORE the
 *     database transaction, so no lock is held while waiting on Gmail.
 *   - All writes for one email happen in ONE transaction: ledger entry, event,
 *     subscription, review items, audit and log are saved together or not at all.
 *   - The ledger is re-checked inside the transaction, so two workers racing on
 *     the same email can't both apply it (the per-account lock serializes them).
 *   - Any error is recorded as a `failed` ledger entry with an attempt count;
 *     the email is retried by later syncs until `maxAttempts`.
 *   - If even recording the failure fails (e.g. the database is down), the error
 *     propagates, so the caller stops and does not advance its sync checkpoint.
 */
import { RawEmailSchema, type EmailSource } from "../collector/email-source";
import { normalizeEmail } from "../collector/normalize";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import {
  auditIdFor,
  emailIdFor,
  eventIdFor,
  subscriptionIdFor,
} from "../dedup/identity";
import type {
  AuditEntry,
  ClassificationResult,
  EmailAnalysis,
  ExtractedSubscriptionData,
  NormalizedEmail,
  PipelineStage,
  ProcessedEmailRecord,
  ReviewReason,
  SubscriptionEvent,
  SubscriptionIdentity,
  SubscriptionRecord,
} from "../domain/types";
import { matchSubscription } from "../matcher/matcher";
import type { Repository, RepositoryTx } from "../persistence/repository";
import { diffSubscription, projectSubscription } from "../state/project";
import { analyzeEmail } from "./analyze";
import {
  errorMessage,
  identityOf,
  logEntry,
  reviewItem,
  reviewItemsFromFindings,
  unique,
} from "./records";

/** Everything the pipeline needs for one connected mailbox. */
export interface EngineContext {
  repo: Repository;
  source: EmailSource;
  accountId: string;
  config?: EngineConfig;
  /** Injectable clock (tests use a fixed time). */
  now?: () => Date;
}

export type ProcessOutcome =
  | {
      status: "skipped";
      emailId: string;
      reason: "already_processed" | "max_attempts";
    }
  | { status: "missing"; emailId: string }
  | { status: "duplicate"; emailId: string; duplicateOf: string }
  | { status: "ignored"; emailId: string }
  | {
      status: "needs_review";
      emailId: string;
      reasons: ReviewReason[];
      subscriptionId: string | null;
    }
  | {
      status: "processed";
      emailId: string;
      eventId: string;
      subscriptionId: string;
      action: AuditEntry["action"];
      reviewReasons: ReviewReason[];
    }
  | { status: "failed"; emailId: string; error: string };

/** An error tagged with the pipeline stage it happened in, for the log. */
class StageError extends Error {
  /** Creates an error that remembers which stage raised it. */
  constructor(
    readonly stage: PipelineStage,
    message: string,
  ) {
    super(message);
    this.name = "StageError";
  }
}

/**
 * Decides whether an email that is already in the ledger should be skipped.
 * Anything except a failure with attempts left is final.
 */
export function skipReason(
  record: ProcessedEmailRecord | null,
  maxAttempts: number,
): "already_processed" | "max_attempts" | null {
  if (!record) return null;
  if (record.status !== "failed") return "already_processed";
  return record.attempts >= maxAttempts ? "max_attempts" : null;
}

/** Builds the ledger entry for an email that was fetched and normalized. */
function ledgerRecord(
  email: NormalizedEmail,
  classification: ClassificationResult | null,
  attempts: number,
  config: EngineConfig,
  now: Date,
  fields: Pick<ProcessedEmailRecord, "status"> & Partial<ProcessedEmailRecord>,
): ProcessedEmailRecord {
  return {
    id: email.id,
    accountId: email.accountId,
    provider: email.provider,
    providerMessageId: email.providerMessageId,
    internetMessageId: email.internetMessageId,
    fingerprint: email.fingerprint,
    receivedAt: email.receivedAt,
    fromAddress: email.from.address,
    // Subject is kept (trimmed) so the audit trail is readable; the body never is.
    subject: email.subject.slice(0, 300),
    eventType: classification?.eventType ?? null,
    classificationScore: classification?.score ?? null,
    subscriptionId: null,
    eventId: null,
    duplicateOf: null,
    attempts,
    lastError: null,
    rulesVersion: config.rulesVersion,
    processedAt: now,
    ...fields,
  };
}

/** Builds the event an accepted email produces. */
function buildEvent(
  email: NormalizedEmail,
  eventId: string,
  subscriptionId: string | null,
  classification: ClassificationResult,
  data: ExtractedSubscriptionData,
  reviewReasons: ReviewReason[],
  now: Date,
): SubscriptionEvent {
  if (!classification.eventType)
    throw new StageError("classify", "Accepted email has no event type");
  return {
    id: eventId,
    accountId: email.accountId,
    emailId: email.id,
    subscriptionId,
    type: classification.eventType,
    occurredAt: email.receivedAt,
    data,
    confidence: classification.score,
    reviewReasons,
    createdAt: now,
  };
}

/**
 * Database part of the pipeline, run inside one transaction:
 * authoritative dedup → ignore / review / apply → audit → ledger → log.
 */
async function applyAnalysis(
  tx: RepositoryTx,
  email: NormalizedEmail,
  analysis: EmailAnalysis,
  config: EngineConfig,
  now: Date,
): Promise<ProcessOutcome> {
  // --- Deduplication (authoritative, under the account lock) ---------------
  const current = await tx.findProcessedEmail(email.id);
  const skip = skipReason(current, config.maxAttempts);
  if (skip) return { status: "skipped", emailId: email.id, reason: skip };
  const attempts = (current?.attempts ?? 0) + 1;
  const { classification: c, extracted } = analysis;

  const duplicate = await tx.findEmailByContentKeys(
    email.accountId,
    {
      internetMessageId: email.internetMessageId,
      fingerprint: email.fingerprint,
    },
    email.id,
  );
  if (duplicate) {
    await tx.saveProcessedEmail(
      ledgerRecord(email, c, attempts, config, now, {
        status: "duplicate",
        duplicateOf: duplicate.id,
      }),
    );
    await tx.appendLog(
      logEntry(
        email.accountId,
        email.id,
        "info",
        "dedup",
        "Same email already analysed under another id",
        { duplicateOf: duplicate.id },
        now,
      ),
    );
    return {
      status: "duplicate",
      emailId: email.id,
      duplicateOf: duplicate.id,
    };
  }

  // --- Not subscription-related ------------------------------------------
  if (c.decision === "ignore" || c.eventType === null || extracted === null) {
    await tx.saveProcessedEmail(
      ledgerRecord(email, c, attempts, config, now, { status: "ignored" }),
    );
    await tx.appendLog(
      logEntry(
        email.accountId,
        email.id,
        "info",
        "classify",
        "Ignored: not subscription-related",
        { score: c.score, signals: c.signals },
        now,
      ),
    );
    return { status: "ignored", emailId: email.id };
  }

  // --- Possibly relevant, but not confident enough to act on --------------
  if (c.decision === "review") {
    await tx.upsertReviewItems([
      reviewItem({
        accountId: email.accountId,
        emailId: email.id,
        eventId: null,
        subscriptionId: null,
        reason: "low_classification_confidence",
        details: {
          suggestedEventType: c.eventType,
          score: c.score,
          signals: c.signals,
          extracted,
        },
        createdAt: now,
      }),
    ]);
    await tx.saveProcessedEmail(
      ledgerRecord(email, c, attempts, config, now, { status: "needs_review" }),
    );
    await tx.appendLog(
      logEntry(
        email.accountId,
        email.id,
        "warn",
        "classify",
        "Sent to review: low confidence",
        { score: c.score, signals: c.signals },
        now,
      ),
    );
    return {
      status: "needs_review",
      emailId: email.id,
      reasons: ["low_classification_confidence"],
      subscriptionId: null,
    };
  }

  // --- Accepted: match to a subscription -----------------------------------
  const eventId = eventIdFor(email.id);
  const reasons = unique<ReviewReason>([
    ...analysis.reviewReasons,
    ...(c.ambiguous ? (["ambiguous_event_type"] as const) : []),
  ]);
  const candidates = await tx.findSubscriptionsByProvider(
    email.accountId,
    extracted.providerKey,
  );
  const match = matchSubscription(candidates, extracted, c.eventType);

  if (match.kind === "ambiguous") {
    // Keep the event (history) but attach it to nothing until a person decides.
    const allReasons = unique<ReviewReason>([...reasons, "ambiguous_match"]);
    await tx.insertEvent(
      buildEvent(email, eventId, null, c, extracted, allReasons, now),
    );
    await tx.upsertReviewItems(
      allReasons.map((reason) =>
        reviewItem({
          accountId: email.accountId,
          emailId: email.id,
          eventId,
          subscriptionId: null,
          reason,
          details:
            reason === "ambiguous_match"
              ? { candidateIds: match.candidateIds }
              : { eventType: c.eventType },
          createdAt: now,
        }),
      ),
    );
    await tx.saveProcessedEmail(
      ledgerRecord(email, c, attempts, config, now, {
        status: "needs_review",
        eventId,
      }),
    );
    await tx.appendLog(
      logEntry(
        email.accountId,
        email.id,
        "warn",
        "match",
        "Event could not be matched to one subscription",
        { candidateIds: match.candidateIds },
        now,
      ),
    );
    return {
      status: "needs_review",
      emailId: email.id,
      reasons: allReasons,
      subscriptionId: null,
    };
  }

  // --- Database update: record the event, then re-project the subscription --
  const previous: SubscriptionRecord | null =
    match.kind === "existing" ? match.subscription : null;
  const identity: SubscriptionIdentity = previous
    ? identityOf(previous)
    : {
        id: subscriptionIdFor(email.accountId, eventId),
        accountId: email.accountId,
        providerKey: extracted.providerKey,
        createdFromEmailId: email.id,
        createdAt: now,
      };

  await tx.insertEvent(
    buildEvent(email, eventId, identity.id, c, extracted, reasons, now),
  );
  const { state, findings } = projectSubscription(
    await tx.listEventsForSubscription(identity.id),
  );
  await tx.upsertReviewItems(
    reviewItemsFromFindings(findings, email.accountId, identity.id, now),
  );
  const needsReview = await tx.hasOpenReviewItems(identity.id);
  const record: SubscriptionRecord = {
    ...identity,
    ...state,
    needsReview,
    updatedAt: now,
  };
  await tx.saveSubscription(record);

  // --- Audit: which email created/updated the subscription, and how --------
  const changes = diffSubscription(previous, record);
  const action: AuditEntry["action"] =
    previous === null
      ? "created"
      : Object.keys(changes).length > 0
        ? "updated"
        : "unchanged";
  await tx.insertAudit({
    id: auditIdFor(eventId),
    accountId: email.accountId,
    subscriptionId: identity.id,
    emailId: email.id,
    eventId,
    action,
    changes,
    createdAt: now,
  });

  await tx.saveProcessedEmail(
    ledgerRecord(email, c, attempts, config, now, {
      status: "processed",
      subscriptionId: identity.id,
      eventId,
    }),
  );
  await tx.appendLog(
    logEntry(
      email.accountId,
      email.id,
      "info",
      "update",
      `Subscription ${action}`,
      {
        subscriptionId: identity.id,
        eventType: c.eventType,
        changedFields: Object.keys(changes),
        reviewReasons: reasons,
      },
      now,
    ),
  );
  return {
    status: "processed",
    emailId: email.id,
    eventId,
    subscriptionId: identity.id,
    action,
    reviewReasons: reasons,
  };
}

/**
 * Records a failed attempt in the ledger (in its own transaction, because the
 * main one was rolled back) and logs it. Throws only if storage itself fails.
 */
async function recordFailure(
  ctx: EngineContext,
  params: {
    emailId: string;
    providerMessageId: string;
    email: NormalizedEmail | null;
    error: unknown;
    config: EngineConfig;
    now: Date;
  },
): Promise<ProcessOutcome> {
  const message = errorMessage(params.error);
  const stage: PipelineStage =
    params.error instanceof StageError ? params.error.stage : "update";
  await ctx.repo.transaction(ctx.accountId, async (tx) => {
    const current = await tx.findProcessedEmail(params.emailId);
    if (current && current.status !== "failed") return; // finished by another worker meanwhile
    const attempts = (current?.attempts ?? 0) + 1;
    const record: ProcessedEmailRecord = params.email
      ? ledgerRecord(params.email, null, attempts, params.config, params.now, {
          status: "failed",
          lastError: message,
        })
      : {
          id: params.emailId,
          accountId: ctx.accountId,
          provider: ctx.source.provider,
          providerMessageId: params.providerMessageId,
          internetMessageId: current?.internetMessageId ?? null,
          fingerprint: current?.fingerprint ?? null,
          receivedAt: current?.receivedAt ?? null,
          fromAddress: current?.fromAddress ?? null,
          subject: current?.subject ?? null,
          status: "failed",
          eventType: null,
          classificationScore: null,
          subscriptionId: null,
          eventId: null,
          duplicateOf: null,
          attempts,
          lastError: message,
          rulesVersion: params.config.rulesVersion,
          processedAt: params.now,
        };
    await tx.saveProcessedEmail(record);
    await tx.appendLog(
      logEntry(
        ctx.accountId,
        params.emailId,
        "error",
        stage,
        message,
        { attempts },
        params.now,
      ),
    );
  });
  return { status: "failed", emailId: params.emailId, error: message };
}

/**
 * Runs one provider message through the full pipeline and reports what
 * happened. Safe to call any number of times for the same message.
 */
export async function processMessage(
  ctx: EngineContext,
  providerMessageId: string,
): Promise<ProcessOutcome> {
  const config = ctx.config ?? DEFAULT_ENGINE_CONFIG;
  const now = ctx.now ?? (() => new Date());
  const emailId = emailIdFor(
    ctx.accountId,
    ctx.source.provider,
    providerMessageId,
  );

  // Deduplication pre-check: don't spend a provider API call on a known email.
  const known = await ctx.repo.getProcessedEmail(emailId);
  const preSkip = skipReason(known, config.maxAttempts);
  if (preSkip) return { status: "skipped", emailId, reason: preSkip };

  let email: NormalizedEmail | null = null;
  try {
    // --- Collector ---
    let raw: unknown;
    try {
      raw = await ctx.source.getMessage(providerMessageId);
    } catch (error) {
      throw new StageError(
        "collect",
        `Could not fetch message: ${errorMessage(error)}`,
      );
    }
    if (raw === null || raw === undefined) {
      await ctx.repo.appendLog(
        logEntry(
          ctx.accountId,
          emailId,
          "warn",
          "collect",
          "Message no longer exists at the provider",
          {},
          now(),
        ),
      );
      return { status: "missing", emailId };
    }
    const parsed = RawEmailSchema.safeParse(raw);
    if (!parsed.success) {
      const fields = parsed.error.issues
        .map((issue) => issue.path.join(".") || "(root)")
        .join(", ");
      throw new StageError(
        "collect",
        `Provider returned an invalid message (fields: ${fields})`,
      );
    }
    if (parsed.data.providerMessageId !== providerMessageId) {
      throw new StageError(
        "collect",
        "Provider returned a different message than requested",
      );
    }
    email = normalizeEmail(parsed.data, {
      accountId: ctx.accountId,
      provider: ctx.source.provider,
    });

    // --- Classifier + Extractor (pure, outside the transaction) ---
    let analysis: EmailAnalysis;
    try {
      analysis = analyzeEmail(email, config);
    } catch (error) {
      throw new StageError("extract", errorMessage(error));
    }

    // --- Dedup (authoritative) + Matcher + Database update + Audit ---
    const normalized = email;
    return await ctx.repo.transaction(ctx.accountId, (tx) =>
      applyAnalysis(tx, normalized, analysis, config, now()),
    );
  } catch (error) {
    return recordFailure(ctx, {
      emailId,
      providerMessageId,
      email,
      error,
      config,
      now: now(),
    });
  }
}

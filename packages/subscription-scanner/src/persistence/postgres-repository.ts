/**
 * PostgreSQL implementation of Repository (also works against Supabase's
 * Postgres using a server-side connection string; never from the browser).
 *
 * - Each transaction takes a transaction-scoped advisory lock on the account,
 *   so emails of one account are processed one at a time even across workers.
 * - `runExclusive` uses a session-level advisory lock on a dedicated
 *   connection, so a second sync for the same account is skipped, not queued.
 * - DATE columns are converted to "YYYY-MM-DD" strings whether the pg driver
 *   returns them as strings or Dates, so no time-zone shifting can happen.
 */
import pg from "pg";
import {
  ExtractedSubscriptionDataSchema,
  type AuditEntry,
  type DateOnly,
  type Money,
  type ProcessedEmailRecord,
  type ProcessingLogEntry,
  type ReviewItem,
  type ReviewReason,
  type SubscriptionEvent,
  type SubscriptionRecord,
  type SyncState,
} from "../domain/types";
import type { Repository, RepositoryTx } from "./repository";

type Row = Record<string, unknown>;
type Queryable = Pick<pg.PoolClient, "query">;

/** Separate key spaces so the per-email lock and the sync lock never collide. */
const TX_LOCK_SEED = 1;
const SYNC_LOCK_SEED = 2;

// ---------------------------------------------------------------------------
// Value conversion helpers
// ---------------------------------------------------------------------------

/** Reads a DATE column as "YYYY-MM-DD" (pg may return a string or a local-midnight Date). */
function asDateOnly(value: unknown): DateOnly | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
}

/** Reads a timestamptz column as a Date. */
function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(String(value));
}

/** Reads a required timestamptz column. */
function asRequiredDate(value: unknown, column: string): Date {
  const date = asDate(value);
  if (!date) throw new Error(`Column ${column} unexpectedly null`);
  return date;
}

/** Reads a nullable text column. */
function asText(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** Reads a nullable numeric column (bigint arrives as a string from pg). */
function asNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Rebuilds a Money value from an amount column and a currency column. */
function asMoney(amount: unknown, currency: unknown): Money | null {
  const minor = asNumber(amount);
  const code = asText(currency);
  return minor === null || code === null
    ? null
    : { amountMinor: minor, currency: code.trim() };
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

/** processed_emails row → ProcessedEmailRecord */
function toProcessedEmail(row: Row): ProcessedEmailRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    provider: String(row.provider),
    providerMessageId: String(row.provider_message_id),
    internetMessageId: asText(row.internet_message_id),
    fingerprint: asText(row.fingerprint),
    receivedAt: asDate(row.received_at),
    fromAddress: asText(row.from_address),
    subject: asText(row.subject),
    status: String(row.status) as ProcessedEmailRecord["status"],
    eventType: asText(row.event_type) as ProcessedEmailRecord["eventType"],
    classificationScore: asNumber(row.classification_score),
    subscriptionId: asText(row.subscription_id),
    eventId: asText(row.event_id),
    duplicateOf: asText(row.duplicate_of),
    attempts: Number(row.attempts),
    lastError: asText(row.last_error),
    rulesVersion: String(row.rules_version),
    processedAt: asRequiredDate(row.processed_at, "processed_at"),
  };
}

/** subscriptions row → SubscriptionRecord */
function toSubscription(row: Row): SubscriptionRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    providerKey: String(row.provider_key),
    providerName: String(row.provider_name),
    billedVia: asText(row.billed_via),
    planName: asText(row.plan_name),
    status: String(row.status) as SubscriptionRecord["status"],
    startDate: asDateOnly(row.start_date),
    renewalDate: asDateOnly(row.renewal_date),
    renewalDateEstimated: Boolean(row.renewal_date_estimated),
    expirationDate: asDateOnly(row.expiration_date),
    cancellationDate: asDateOnly(row.cancellation_date),
    billingFrequency: asText(
      row.billing_frequency,
    ) as SubscriptionRecord["billingFrequency"],
    price: asMoney(row.price_minor, row.currency),
    previousPrice: asMoney(row.previous_price_minor, row.previous_currency),
    isTrial: Boolean(row.is_trial),
    trialEndDate: asDateOnly(row.trial_end_date),
    lastPaymentDate: asDateOnly(row.last_payment_date),
    needsReview: Boolean(row.needs_review),
    createdFromEmailId: String(row.created_from_email_id),
    lastEmailId: asText(row.last_email_id),
    lastEventAt: asDate(row.last_event_at),
    createdAt: asRequiredDate(row.created_at, "created_at"),
    updatedAt: asRequiredDate(row.updated_at, "updated_at"),
  };
}

/** subscription_events row → SubscriptionEvent (the JSON payload is re-validated). */
function toEvent(row: Row): SubscriptionEvent {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    emailId: String(row.email_id),
    subscriptionId: asText(row.subscription_id),
    type: String(row.event_type) as SubscriptionEvent["type"],
    occurredAt: asRequiredDate(row.occurred_at, "occurred_at"),
    data: ExtractedSubscriptionDataSchema.parse(row.data),
    confidence: Number(row.confidence),
    reviewReasons: (row.review_reasons as ReviewReason[] | null) ?? [],
    createdAt: asRequiredDate(row.created_at, "created_at"),
  };
}

/** review_items row → ReviewItem */
function toReviewItem(row: Row): ReviewItem {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    emailId: String(row.email_id),
    eventId: asText(row.event_id),
    subscriptionId: asText(row.subscription_id),
    reason: String(row.reason) as ReviewReason,
    details: (row.details as Record<string, unknown> | null) ?? {},
    status: String(row.status) as ReviewItem["status"],
    createdAt: asRequiredDate(row.created_at, "created_at"),
  };
}

/** sync_state row → SyncState */
function toSyncState(row: Row): SyncState {
  return {
    accountId: String(row.account_id),
    phase: String(row.phase) as SyncState["phase"],
    checkpoint: asText(row.checkpoint),
    scanSince: asDate(row.scan_since),
    scanPageToken: asText(row.scan_page_token),
    initialScanCompletedAt: asDate(row.initial_scan_completed_at),
    lastSyncedAt: asDate(row.last_synced_at),
  };
}

// ---------------------------------------------------------------------------
// Shared statements (usable with the pool or a transaction client)
// ---------------------------------------------------------------------------

/** Inserts one processing-log row. */
async function insertLog(
  db: Queryable,
  entry: ProcessingLogEntry,
): Promise<void> {
  await db.query(
    `insert into processing_log (account_id, email_id, level, stage, message, details, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.accountId,
      entry.emailId,
      entry.level,
      entry.stage,
      entry.message,
      JSON.stringify(entry.details),
      entry.createdAt,
    ],
  );
}

/** Loads one ledger row by id. */
async function selectProcessedEmail(
  db: Queryable,
  id: string,
): Promise<ProcessedEmailRecord | null> {
  const { rows } = await db.query(
    "select * from processed_emails where id = $1",
    [id],
  );
  return rows[0] ? toProcessedEmail(rows[0]) : null;
}

/** Transaction-scoped operations bound to one client. */
class PgTx implements RepositoryTx {
  /** Wraps a client that already has an open transaction. */
  constructor(private readonly db: Queryable) {}

  findProcessedEmail(id: string): Promise<ProcessedEmailRecord | null> {
    return selectProcessedEmail(this.db, id);
  }

  async findEmailByContentKeys(
    accountId: string,
    keys: { internetMessageId: string | null; fingerprint: string },
    excludeId: string,
  ): Promise<ProcessedEmailRecord | null> {
    const { rows } = await this.db.query(
      `select * from processed_emails
        where account_id = $1 and id <> $2 and status not in ('duplicate', 'failed')
          and ((internet_message_id is not null and internet_message_id = $3) or fingerprint = $4)
        order by processed_at, id
        limit 1`,
      [accountId, excludeId, keys.internetMessageId, keys.fingerprint],
    );
    return rows[0] ? toProcessedEmail(rows[0]) : null;
  }

  async saveProcessedEmail(r: ProcessedEmailRecord): Promise<void> {
    await this.db.query(
      `insert into processed_emails (id, account_id, provider, provider_message_id, internet_message_id, fingerprint,
         received_at, from_address, subject, status, event_type, classification_score, subscription_id, event_id,
         duplicate_of, attempts, last_error, rules_version, processed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       on conflict (id) do update set
         internet_message_id = excluded.internet_message_id, fingerprint = excluded.fingerprint,
         received_at = excluded.received_at, from_address = excluded.from_address, subject = excluded.subject,
         status = excluded.status, event_type = excluded.event_type,
         classification_score = excluded.classification_score, subscription_id = excluded.subscription_id,
         event_id = excluded.event_id, duplicate_of = excluded.duplicate_of, attempts = excluded.attempts,
         last_error = excluded.last_error, rules_version = excluded.rules_version, processed_at = excluded.processed_at`,
      [
        r.id,
        r.accountId,
        r.provider,
        r.providerMessageId,
        r.internetMessageId,
        r.fingerprint,
        r.receivedAt,
        r.fromAddress,
        r.subject,
        r.status,
        r.eventType,
        r.classificationScore,
        r.subscriptionId,
        r.eventId,
        r.duplicateOf,
        r.attempts,
        r.lastError,
        r.rulesVersion,
        r.processedAt,
      ],
    );
  }

  async findSubscriptionsByProvider(
    accountId: string,
    providerKey: string,
  ): Promise<SubscriptionRecord[]> {
    const { rows } = await this.db.query(
      "select * from subscriptions where account_id = $1 and provider_key = $2 order by created_at, id",
      [accountId, providerKey],
    );
    return rows.map(toSubscription);
  }

  async getSubscription(id: string): Promise<SubscriptionRecord | null> {
    const { rows } = await this.db.query(
      "select * from subscriptions where id = $1",
      [id],
    );
    return rows[0] ? toSubscription(rows[0]) : null;
  }

  async saveSubscription(s: SubscriptionRecord): Promise<void> {
    await this.db.query(
      `insert into subscriptions (id, account_id, provider_key, provider_name, billed_via, plan_name, status,
         start_date, renewal_date, renewal_date_estimated, expiration_date, cancellation_date, billing_frequency,
         price_minor, currency, previous_price_minor, previous_currency, is_trial, trial_end_date,
         last_payment_date, needs_review, created_from_email_id, last_email_id, last_event_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       on conflict (id) do update set
         provider_name = excluded.provider_name, billed_via = excluded.billed_via, plan_name = excluded.plan_name,
         status = excluded.status, start_date = excluded.start_date, renewal_date = excluded.renewal_date,
         renewal_date_estimated = excluded.renewal_date_estimated, expiration_date = excluded.expiration_date,
         cancellation_date = excluded.cancellation_date, billing_frequency = excluded.billing_frequency,
         price_minor = excluded.price_minor, currency = excluded.currency,
         previous_price_minor = excluded.previous_price_minor, previous_currency = excluded.previous_currency,
         is_trial = excluded.is_trial, trial_end_date = excluded.trial_end_date,
         last_payment_date = excluded.last_payment_date, needs_review = excluded.needs_review,
         last_email_id = excluded.last_email_id, last_event_at = excluded.last_event_at,
         updated_at = excluded.updated_at`,
      [
        s.id,
        s.accountId,
        s.providerKey,
        s.providerName,
        s.billedVia,
        s.planName,
        s.status,
        s.startDate,
        s.renewalDate,
        s.renewalDateEstimated,
        s.expirationDate,
        s.cancellationDate,
        s.billingFrequency,
        s.price?.amountMinor ?? null,
        s.price?.currency ?? null,
        s.previousPrice?.amountMinor ?? null,
        s.previousPrice?.currency ?? null,
        s.isTrial,
        s.trialEndDate,
        s.lastPaymentDate,
        s.needsReview,
        s.createdFromEmailId,
        s.lastEmailId,
        s.lastEventAt,
        s.createdAt,
        s.updatedAt,
      ],
    );
  }

  async insertEvent(e: SubscriptionEvent): Promise<void> {
    await this.db.query(
      `insert into subscription_events (id, account_id, email_id, subscription_id, event_type, occurred_at, data,
         confidence, review_reasons, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        e.id,
        e.accountId,
        e.emailId,
        e.subscriptionId,
        e.type,
        e.occurredAt,
        JSON.stringify(e.data),
        e.confidence,
        e.reviewReasons,
        e.createdAt,
      ],
    );
  }

  async listEventsForSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionEvent[]> {
    const { rows } = await this.db.query(
      "select * from subscription_events where subscription_id = $1 order by occurred_at, id",
      [subscriptionId],
    );
    return rows.map(toEvent);
  }

  async insertAudit(a: AuditEntry): Promise<void> {
    await this.db.query(
      `insert into subscription_audit (id, account_id, subscription_id, email_id, event_id, action, changes, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
      [
        a.id,
        a.accountId,
        a.subscriptionId,
        a.emailId,
        a.eventId,
        a.action,
        JSON.stringify(a.changes),
        a.createdAt,
      ],
    );
  }

  async upsertReviewItems(items: ReviewItem[]): Promise<void> {
    for (const r of items) {
      await this.db.query(
        `insert into review_items (id, account_id, email_id, event_id, subscription_id, reason, details, status, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
        [
          r.id,
          r.accountId,
          r.emailId,
          r.eventId,
          r.subscriptionId,
          r.reason,
          JSON.stringify(r.details),
          r.status,
          r.createdAt,
        ],
      );
    }
  }

  async hasOpenReviewItems(subscriptionId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `select exists(select 1 from review_items where subscription_id = $1 and status = 'open') as open`,
      [subscriptionId],
    );
    return Boolean(rows[0]?.open);
  }

  appendLog(entry: ProcessingLogEntry): Promise<void> {
    return insertLog(this.db, entry);
  }
}

export class PostgresRepository implements Repository {
  /** Uses an existing pg Pool (server-side only; the connection string is a secret). */
  constructor(private readonly pool: pg.Pool) {}

  /** Convenience constructor from a connection string, e.g. process.env.DATABASE_URL. */
  static fromConnectionString(connectionString: string): PostgresRepository {
    return new PostgresRepository(new pg.Pool({ connectionString }));
  }

  /** BEGIN → per-account advisory lock → work → COMMIT; ROLLBACK on any error. */
  async transaction<T>(
    accountId: string,
    work: (tx: RepositoryTx) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, $2))",
        [accountId, TX_LOCK_SEED],
      );
      const result = await work(new PgTx(client));
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Holds a session-level advisory lock on a dedicated connection while `work` runs. */
  async runExclusive<T>(
    lockKey: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query(
        "select pg_try_advisory_lock(hashtextextended($1, $2)) as locked",
        [lockKey, SYNC_LOCK_SEED],
      );
      if (!rows[0]?.locked) return null;
      try {
        return await work();
      } finally {
        await client.query(
          "select pg_advisory_unlock(hashtextextended($1, $2))",
          [lockKey, SYNC_LOCK_SEED],
        );
      }
    } finally {
      client.release();
    }
  }

  getProcessedEmail(id: string): Promise<ProcessedEmailRecord | null> {
    return selectProcessedEmail(this.pool, id);
  }

  async listRetryableFailures(
    accountId: string,
    maxAttempts: number,
    limit: number,
  ): Promise<ProcessedEmailRecord[]> {
    const { rows } = await this.pool.query(
      `select * from processed_emails where account_id = $1 and status = 'failed' and attempts < $2
        order by processed_at, id limit $3`,
      [accountId, maxAttempts, limit],
    );
    return rows.map(toProcessedEmail);
  }

  async getSyncState(accountId: string): Promise<SyncState | null> {
    const { rows } = await this.pool.query(
      "select * from sync_state where account_id = $1",
      [accountId],
    );
    return rows[0] ? toSyncState(rows[0]) : null;
  }

  async saveSyncState(s: SyncState): Promise<void> {
    await this.pool.query(
      `insert into sync_state (account_id, phase, checkpoint, scan_since, scan_page_token, initial_scan_completed_at,
         last_synced_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (account_id) do update set
         phase = excluded.phase, checkpoint = excluded.checkpoint, scan_since = excluded.scan_since,
         scan_page_token = excluded.scan_page_token, initial_scan_completed_at = excluded.initial_scan_completed_at,
         last_synced_at = excluded.last_synced_at, updated_at = now()`,
      [
        s.accountId,
        s.phase,
        s.checkpoint,
        s.scanSince,
        s.scanPageToken,
        s.initialScanCompletedAt,
        s.lastSyncedAt,
      ],
    );
  }

  async listSubscriptionIds(accountId: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      "select id from subscriptions where account_id = $1 order by id",
      [accountId],
    );
    return rows.map((r: Row) => String(r.id));
  }

  async listSubscriptions(accountId: string): Promise<SubscriptionRecord[]> {
    const { rows } = await this.pool.query(
      "select * from subscriptions where account_id = $1 order by created_at, id",
      [accountId],
    );
    return rows.map(toSubscription);
  }

  async listOpenReviewItems(accountId: string): Promise<ReviewItem[]> {
    const { rows } = await this.pool.query(
      `select * from review_items where account_id = $1 and status = 'open' order by created_at, id`,
      [accountId],
    );
    return rows.map(toReviewItem);
  }

  appendLog(entry: ProcessingLogEntry): Promise<void> {
    return insertLog(this.pool, entry);
  }
}

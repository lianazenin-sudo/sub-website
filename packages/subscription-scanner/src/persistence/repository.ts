/**
 * Storage contract used by the pipeline.
 *
 * The pipeline only talks to these interfaces, so business logic doesn't
 * depend on a database. Two implementations exist:
 *   - InMemoryRepository  (tests, local development)
 *   - PostgresRepository  (production; works with Supabase Postgres)
 *
 * Correctness requirements every implementation must meet:
 *   - `transaction` is atomic (all writes or none) and serialized per account,
 *     so two workers can't both create the same subscription.
 *   - An email id can have at most one event (unique constraint), which makes
 *     "one email creates two subscriptions" impossible at the storage level.
 */
import type {
  AuditEntry,
  ProcessedEmailRecord,
  ProcessingLogEntry,
  ReviewItem,
  SubscriptionEvent,
  SubscriptionRecord,
  SyncState,
} from "../domain/types";

/** Operations available inside one atomic, per-account transaction. */
export interface RepositoryTx {
  /** Ledger lookup by internal email id. */
  findProcessedEmail(id: string): Promise<ProcessedEmailRecord | null>;
  /**
   * Finds a different, already-analysed email with the same Message-ID header
   * or content fingerprint (duplicates and failures are not counted).
   */
  findEmailByContentKeys(
    accountId: string,
    keys: { internetMessageId: string | null; fingerprint: string },
    excludeId: string,
  ): Promise<ProcessedEmailRecord | null>;
  /** Inserts or updates a ledger entry (keyed by id). */
  saveProcessedEmail(record: ProcessedEmailRecord): Promise<void>;
  /** All of an account's subscriptions for one provider, oldest first. */
  findSubscriptionsByProvider(
    accountId: string,
    providerKey: string,
  ): Promise<SubscriptionRecord[]>;
  getSubscription(id: string): Promise<SubscriptionRecord | null>;
  /** Inserts or updates a subscription (keyed by id). */
  saveSubscription(record: SubscriptionRecord): Promise<void>;
  /** Inserts an event. Must fail if the id or the email id already has an event. */
  insertEvent(event: SubscriptionEvent): Promise<void>;
  /** All events attached to a subscription, ordered by occurredAt then id. */
  listEventsForSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionEvent[]>;
  /** Appends an audit entry (ignored if that id already exists). */
  insertAudit(entry: AuditEntry): Promise<void>;
  /** Inserts review items; existing ids are left untouched so resolved items stay resolved. */
  upsertReviewItems(items: ReviewItem[]): Promise<void>;
  /** True if the subscription has any unresolved review item. */
  hasOpenReviewItems(subscriptionId: string): Promise<boolean>;
  appendLog(entry: ProcessingLogEntry): Promise<void>;
}

export interface Repository {
  /**
   * Runs `work` atomically while holding the account's lock. If `work`
   * throws, nothing it wrote is kept and the error is re-thrown.
   */
  transaction<T>(
    accountId: string,
    work: (tx: RepositoryTx) => Promise<T>,
  ): Promise<T>;
  /**
   * Runs `work` only if no other caller holds `lockKey`; returns null when
   * someone else does. Used so only one sync per account runs at a time.
   */
  runExclusive<T>(lockKey: string, work: () => Promise<T>): Promise<T | null>;
  getProcessedEmail(id: string): Promise<ProcessedEmailRecord | null>;
  /** Failed emails that still have attempts left, oldest first. */
  listRetryableFailures(
    accountId: string,
    maxAttempts: number,
    limit: number,
  ): Promise<ProcessedEmailRecord[]>;
  getSyncState(accountId: string): Promise<SyncState | null>;
  saveSyncState(state: SyncState): Promise<void>;
  listSubscriptionIds(accountId: string): Promise<string[]>;
  listSubscriptions(accountId: string): Promise<SubscriptionRecord[]>;
  listOpenReviewItems(accountId: string): Promise<ReviewItem[]>;
  /** Writes a log entry outside any transaction (used after a rollback). */
  appendLog(entry: ProcessingLogEntry): Promise<void>;
}

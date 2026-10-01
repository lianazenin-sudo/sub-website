/**
 * In-memory Repository for tests and local development.
 *
 * Transactions are emulated by running one at a time and restoring a deep
 * copy of the store if the work throws, so tests see the same all-or-nothing
 * behaviour as Postgres. Not meant for production (no persistence).
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
import type { Repository, RepositoryTx } from "./repository";

interface Store {
  processed: Map<string, ProcessedEmailRecord>;
  subscriptions: Map<string, SubscriptionRecord>;
  events: Map<string, SubscriptionEvent>;
  audit: Map<string, AuditEntry>;
  reviews: Map<string, ReviewItem>;
  logs: ProcessingLogEntry[];
  sync: Map<string, SyncState>;
}

/** Creates an empty store. */
function emptyStore(): Store {
  return {
    processed: new Map(),
    subscriptions: new Map(),
    events: new Map(),
    audit: new Map(),
    reviews: new Map(),
    logs: [],
    sync: new Map(),
  };
}

/** Returns a deep copy so callers can't mutate stored objects by accident. */
function copy<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryRepository implements Repository {
  private store: Store = emptyStore();
  /** Promise chain that serializes transactions. */
  private queue: Promise<unknown> = Promise.resolve();
  private readonly heldLocks = new Set<string>();

  /** Runs `work` alone; on error, restores the store to how it was before. */
  async transaction<T>(
    _accountId: string,
    work: (tx: RepositoryTx) => Promise<T>,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const snapshot = copy(this.store);
      try {
        return await work(this.createTx());
      } catch (error) {
        this.store = snapshot;
        throw error;
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Runs `work` unless another caller already holds `lockKey`. */
  async runExclusive<T>(
    lockKey: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    if (this.heldLocks.has(lockKey)) return null;
    this.heldLocks.add(lockKey);
    try {
      return await work();
    } finally {
      this.heldLocks.delete(lockKey);
    }
  }

  async getProcessedEmail(id: string): Promise<ProcessedEmailRecord | null> {
    const found = this.store.processed.get(id);
    return found ? copy(found) : null;
  }

  async listRetryableFailures(
    accountId: string,
    maxAttempts: number,
    limit: number,
  ): Promise<ProcessedEmailRecord[]> {
    return [...this.store.processed.values()]
      .filter(
        (r) =>
          r.accountId === accountId &&
          r.status === "failed" &&
          r.attempts < maxAttempts,
      )
      .sort((a, b) => a.processedAt.getTime() - b.processedAt.getTime())
      .slice(0, limit)
      .map(copy);
  }

  async getSyncState(accountId: string): Promise<SyncState | null> {
    const found = this.store.sync.get(accountId);
    return found ? copy(found) : null;
  }

  async saveSyncState(state: SyncState): Promise<void> {
    this.store.sync.set(state.accountId, copy(state));
  }

  async listSubscriptionIds(accountId: string): Promise<string[]> {
    return [...this.store.subscriptions.values()]
      .filter((s) => s.accountId === accountId)
      .map((s) => s.id)
      .sort();
  }

  async listSubscriptions(accountId: string): Promise<SubscriptionRecord[]> {
    return [...this.store.subscriptions.values()]
      .filter((s) => s.accountId === accountId)
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map(copy);
  }

  async listOpenReviewItems(accountId: string): Promise<ReviewItem[]> {
    return [...this.store.reviews.values()]
      .filter((r) => r.accountId === accountId && r.status === "open")
      .map(copy);
  }

  async appendLog(entry: ProcessingLogEntry): Promise<void> {
    this.store.logs.push(copy(entry));
  }

  /** Test helper: every event stored for an account. */
  allEvents(accountId: string): SubscriptionEvent[] {
    return [...this.store.events.values()]
      .filter((e) => e.accountId === accountId)
      .map(copy);
  }

  /** Test helper: every audit entry stored for an account. */
  allAudit(accountId: string): AuditEntry[] {
    return [...this.store.audit.values()]
      .filter((a) => a.accountId === accountId)
      .map(copy);
  }

  /** Test helper: every ledger entry stored for an account. */
  allProcessed(accountId: string): ProcessedEmailRecord[] {
    return [...this.store.processed.values()]
      .filter((p) => p.accountId === accountId)
      .map(copy);
  }

  /** Test helper: the processing log. */
  allLogs(): ProcessingLogEntry[] {
    return this.store.logs.map(copy);
  }

  /** Builds the transaction view. Methods read `this.store` at call time, so a rollback is seen immediately. */
  private createTx(): RepositoryTx {
    return {
      findProcessedEmail: async (id) => {
        const found = this.store.processed.get(id);
        return found ? copy(found) : null;
      },
      findEmailByContentKeys: async (accountId, keys, excludeId) => {
        for (const r of this.store.processed.values()) {
          if (r.accountId !== accountId || r.id === excludeId) continue;
          if (r.status === "duplicate" || r.status === "failed") continue;
          const sameMessageId =
            keys.internetMessageId !== null &&
            r.internetMessageId === keys.internetMessageId;
          if (sameMessageId || r.fingerprint === keys.fingerprint)
            return copy(r);
        }
        return null;
      },
      saveProcessedEmail: async (record) => {
        this.store.processed.set(record.id, copy(record));
      },
      findSubscriptionsByProvider: async (accountId, providerKey) =>
        [...this.store.subscriptions.values()]
          .filter(
            (s) => s.accountId === accountId && s.providerKey === providerKey,
          )
          .sort(
            (a, b) =>
              a.createdAt.getTime() - b.createdAt.getTime() ||
              a.id.localeCompare(b.id),
          )
          .map(copy),
      getSubscription: async (id) => {
        const found = this.store.subscriptions.get(id);
        return found ? copy(found) : null;
      },
      saveSubscription: async (record) => {
        this.store.subscriptions.set(record.id, copy(record));
      },
      insertEvent: async (event) => {
        // Mirrors the database's primary key and UNIQUE(email_id) constraints.
        if (this.store.events.has(event.id))
          throw new Error(`duplicate event id ${event.id}`);
        for (const e of this.store.events.values()) {
          if (e.emailId === event.emailId)
            throw new Error(`email ${event.emailId} already has an event`);
        }
        this.store.events.set(event.id, copy(event));
      },
      listEventsForSubscription: async (subscriptionId) =>
        [...this.store.events.values()]
          .filter((e) => e.subscriptionId === subscriptionId)
          .sort(
            (a, b) =>
              a.occurredAt.getTime() - b.occurredAt.getTime() ||
              a.id.localeCompare(b.id),
          )
          .map(copy),
      insertAudit: async (entry) => {
        if (!this.store.audit.has(entry.id))
          this.store.audit.set(entry.id, copy(entry));
      },
      upsertReviewItems: async (items) => {
        for (const item of items) {
          if (!this.store.reviews.has(item.id))
            this.store.reviews.set(item.id, copy(item));
        }
      },
      hasOpenReviewItems: async (subscriptionId) =>
        [...this.store.reviews.values()].some(
          (r) => r.subscriptionId === subscriptionId && r.status === "open",
        ),
      appendLog: async (entry) => {
        this.store.logs.push(copy(entry));
      },
    };
  }
}

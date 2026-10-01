/**
 * Inbox monitoring: the initial historical scan and continuous tracking.
 *
 * Call `syncAccount` from a scheduler (e.g. every few minutes) and/or when
 * the provider pushes a "mailbox changed" notification (Gmail watch +
 * Pub/Sub). Each run:
 *
 *   1. Initial phase (first run only, resumable):
 *      - take a checkpoint FIRST, so mail arriving during the scan is picked
 *        up afterwards by the incremental step;
 *      - page through the last N months, saving the page token after every
 *        page so a crash resumes where it stopped.
 *   2. Incremental phase: process messages added since the checkpoint, then
 *      move the checkpoint forward (only after they were all handled).
 *      If the provider has discarded that history, rescan from the last
 *      successful sync instead. Overlap is harmless: processing is idempotent.
 *   3. Retry emails that failed in earlier runs and still have attempts left.
 *
 * Only one sync per account runs at a time (Repository.runExclusive).
 */
import { DEFAULT_ENGINE_CONFIG } from "../config";
import { subtractMonths } from "../domain/date-only";
import type { SyncState } from "../domain/types";
import {
  processMessage,
  type EngineContext,
  type ProcessOutcome,
} from "./process-email";
import { errorMessage, logEntry } from "./records";

const ONE_DAY_MS = 86_400_000;

export interface SyncReport {
  accountId: string;
  /** False when another sync for this account was already running. */
  ran: boolean;
  initialScanCompleted: boolean;
  /** True when change history had expired and a bounded rescan was done. */
  fullRescan: boolean;
  outcomes: Record<ProcessOutcome["status"], number>;
}

/** Creates an empty report. */
function emptyReport(accountId: string): SyncReport {
  return {
    accountId,
    ran: true,
    initialScanCompleted: false,
    fullRescan: false,
    outcomes: {
      skipped: 0,
      missing: 0,
      duplicate: 0,
      ignored: 0,
      needs_review: 0,
      processed: 0,
      failed: 0,
    },
  };
}

/** Sync state for an account that has never been synced. */
function initialSyncState(accountId: string): SyncState {
  return {
    accountId,
    phase: "initial",
    checkpoint: null,
    scanSince: null,
    scanPageToken: null,
    initialScanCompletedAt: null,
    lastSyncedAt: null,
  };
}

/** Processes message ids one by one (in order) and tallies the outcomes. */
async function processIds(
  ctx: EngineContext,
  ids: readonly string[],
  report: SyncReport,
): Promise<void> {
  for (const id of ids) {
    const outcome = await processMessage(ctx, id);
    report.outcomes[outcome.status] += 1;
  }
}

/**
 * Pages through every message received since `since`. `onPage` is called
 * after each page with the next page token so callers can persist progress.
 * If a saved page token is rejected, the scan restarts from the first page
 * (already-processed emails are skipped cheaply).
 */
async function scanSince(
  ctx: EngineContext,
  since: Date,
  startToken: string | null,
  report: SyncReport,
  onPage: (nextToken: string | null) => Promise<void>,
): Promise<void> {
  const pageSize = (ctx.config ?? DEFAULT_ENGINE_CONFIG).pageSize;
  const now = ctx.now ?? (() => new Date());
  let pageToken = startToken;
  for (;;) {
    let page;
    try {
      page = await ctx.source.listMessages({ since, pageToken, pageSize });
    } catch (error) {
      if (pageToken === null) throw error;
      await ctx.repo.appendLog(
        logEntry(
          ctx.accountId,
          null,
          "warn",
          "sync",
          "Saved page token rejected; restarting scan",
          { error: errorMessage(error) },
          now(),
        ),
      );
      pageToken = null;
      continue;
    }
    await processIds(ctx, page.messageIds, report);
    pageToken = page.nextPageToken;
    await onPage(pageToken);
    if (pageToken === null) return;
  }
}

/** Step 1: the first, historical scan of a newly connected mailbox. */
async function runInitialScan(
  ctx: EngineContext,
  state: SyncState,
  report: SyncReport,
): Promise<SyncState> {
  const config = ctx.config ?? DEFAULT_ENGINE_CONFIG;
  const now = ctx.now ?? (() => new Date());
  let current = state;

  if (current.checkpoint === null || current.scanSince === null) {
    current = {
      ...current,
      checkpoint: await ctx.source.getCheckpoint(),
      scanSince: subtractMonths(now(), config.initialScanMonths),
      scanPageToken: null,
    };
    await ctx.repo.saveSyncState(current);
  }

  const since =
    current.scanSince ?? subtractMonths(now(), config.initialScanMonths);
  await scanSince(
    ctx,
    since,
    current.scanPageToken,
    report,
    async (nextToken) => {
      current = { ...current, scanPageToken: nextToken };
      await ctx.repo.saveSyncState(current);
    },
  );

  current = {
    ...current,
    phase: "incremental",
    scanPageToken: null,
    initialScanCompletedAt: now(),
  };
  await ctx.repo.saveSyncState(current);
  report.initialScanCompleted = true;
  return current;
}

/** Step 2: process what changed since the checkpoint (or rescan if history expired). */
async function runIncremental(
  ctx: EngineContext,
  state: SyncState,
  report: SyncReport,
): Promise<SyncState> {
  const now = ctx.now ?? (() => new Date());
  if (state.checkpoint === null) {
    const fresh = { ...state, checkpoint: await ctx.source.getCheckpoint() };
    await ctx.repo.saveSyncState(fresh);
    return fresh;
  }

  const changes = await ctx.source.listChangesSince(state.checkpoint);
  if (changes.status === "ok") {
    await processIds(ctx, changes.messageIds, report);
    const next = { ...state, checkpoint: changes.checkpoint };
    await ctx.repo.saveSyncState(next);
    return next;
  }

  // History expired: take a new checkpoint first, then rescan the gap.
  const freshCheckpoint = await ctx.source.getCheckpoint();
  const lastKnown =
    state.lastSyncedAt ??
    state.initialScanCompletedAt ??
    state.scanSince ??
    now();
  const since = new Date(lastKnown.getTime() - ONE_DAY_MS);
  await ctx.repo.appendLog(
    logEntry(
      ctx.accountId,
      null,
      "warn",
      "sync",
      "Change history expired; rescanning recent mail",
      { since: since.toISOString() },
      now(),
    ),
  );
  await scanSince(ctx, since, null, report, async () => undefined);
  report.fullRescan = true;
  const next = { ...state, checkpoint: freshCheckpoint };
  await ctx.repo.saveSyncState(next);
  return next;
}

/** Step 3: retry emails that failed before this run started. */
async function retryFailures(
  ctx: EngineContext,
  runStartedAt: Date,
  report: SyncReport,
): Promise<void> {
  const config = ctx.config ?? DEFAULT_ENGINE_CONFIG;
  const failures = await ctx.repo.listRetryableFailures(
    ctx.accountId,
    config.maxAttempts,
    config.retryBatchSize,
  );
  const fromEarlierRuns = failures.filter(
    (f) => f.processedAt.getTime() < runStartedAt.getTime(),
  );
  await processIds(
    ctx,
    fromEarlierRuns.map((f) => f.providerMessageId),
    report,
  );
}

/** One full sync run (called while holding the account's sync lock). */
async function runSync(ctx: EngineContext, report: SyncReport): Promise<void> {
  const now = ctx.now ?? (() => new Date());
  const runStartedAt = now();
  let state =
    (await ctx.repo.getSyncState(ctx.accountId)) ??
    initialSyncState(ctx.accountId);
  if (state.phase === "initial")
    state = await runInitialScan(ctx, state, report);
  state = await runIncremental(ctx, state, report);
  await retryFailures(ctx, runStartedAt, report);
  await ctx.repo.saveSyncState({ ...state, lastSyncedAt: now() });
  await ctx.repo.appendLog(
    logEntry(
      ctx.accountId,
      null,
      "info",
      "sync",
      "Sync finished",
      { ...report.outcomes, fullRescan: report.fullRescan },
      now(),
    ),
  );
}

/**
 * Brings one mailbox up to date. Returns a report of what happened; if
 * another sync for the same account is already running, returns immediately
 * with `ran: false`. Throws only on infrastructure failures (e.g. database
 * unreachable), in which case the checkpoint is not advanced.
 */
export async function syncAccount(ctx: EngineContext): Promise<SyncReport> {
  const report = emptyReport(ctx.accountId);
  try {
    const ran = await ctx.repo.runExclusive(
      `sync:${ctx.accountId}`,
      async () => {
        await runSync(ctx, report);
        return true;
      },
    );
    if (ran === null) report.ran = false;
    return report;
  } catch (error) {
    const now = ctx.now ?? (() => new Date());
    await ctx.repo
      .appendLog(
        logEntry(
          ctx.accountId,
          null,
          "error",
          "sync",
          `Sync aborted: ${errorMessage(error)}`,
          {},
          now(),
        ),
      )
      .catch(() => undefined);
    throw error;
  }
}

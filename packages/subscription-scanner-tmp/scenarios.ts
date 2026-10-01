/**
 * End-to-end scenarios run against any Repository implementation, so the
 * in-memory and Postgres stores are held to exactly the same behaviour.
 */
import assert from "node:assert/strict";
import type { Repository } from "../src/persistence/repository";
import { processMessage } from "../src/pipeline/process-email";
import { rebuildAccountSubscriptions } from "../src/pipeline/rebuild";
import { syncAccount } from "../src/pipeline/sync";
import { emailIdFor } from "../src/dedup/identity";
import { INBOX, mail, spotifyReceipt } from "./fixtures";
import {
  FlakySource,
  byProvider,
  setup,
  steppingClock,
  stateOf,
} from "./helpers";

/** Initial scan → correct subscriptions, noise ignored, duplicate detected. */
export async function initialScanScenario(repo: Repository): Promise<void> {
  const { source, ctx } = setup(repo);
  for (const m of INBOX) source.deliver(m);

  const report = await syncAccount(ctx);
  assert.equal(report.ran, true);
  assert.equal(report.initialScanCompleted, true);
  assert.deepEqual(report.outcomes, {
    skipped: 0,
    missing: 0,
    duplicate: 1,
    ignored: 5,
    needs_review: 0,
    processed: 6,
    failed: 0,
  });

  const subs = await repo.listSubscriptions(ctx.accountId);
  assert.equal(subs.length, 2, "exactly Netflix and Spotify");

  const netflix = byProvider(subs, "netflix");
  assert.equal(netflix.status, "cancelled");
  assert.equal(netflix.planName, "Standard");
  assert.deepEqual(netflix.price, { amountMinor: 1799, currency: "USD" });
  assert.deepEqual(netflix.previousPrice, {
    amountMinor: 1549,
    currency: "USD",
  });
  assert.equal(netflix.billingFrequency, "monthly");
  assert.equal(netflix.startDate, "2026-03-01");
  assert.equal(netflix.cancellationDate, "2026-07-15");
  assert.equal(netflix.expirationDate, "2026-08-01");
  assert.equal(netflix.renewalDate, null);
  assert.equal(netflix.lastPaymentDate, "2026-04-01");
  assert.equal(netflix.needsReview, false);

  const spotify = byProvider(subs, "spotify");
  assert.equal(spotify.status, "trialing");
  assert.equal(spotify.isTrial, true);
  assert.equal(spotify.trialEndDate, "2026-10-04");
  assert.equal(spotify.planName, "Premium Individual");
  assert.deepEqual(spotify.price, { amountMinor: 29900, currency: "PKR" });
  assert.equal(spotify.billingFrequency, "monthly");
  assert.equal(spotify.startDate, "2026-09-04");

  // Running again changes nothing and processes nothing.
  const before = (await repo.listSubscriptions(ctx.accountId)).map(stateOf);
  const again = await syncAccount(ctx);
  assert.equal(again.outcomes.processed, 0);
  assert.equal(again.outcomes.failed, 0);
  assert.deepEqual(
    (await repo.listSubscriptions(ctx.accountId)).map(stateOf),
    before,
  );
  const direct = await processMessage(ctx, "m-netflix-welcome");
  assert.deepEqual(direct, {
    status: "skipped",
    emailId: emailIdFor(ctx.accountId, "memory", "m-netflix-welcome"),
    reason: "already_processed",
  });

  // Continuous tracking: a new receipt converts the trial into a paid subscription.
  source.deliver(spotifyReceipt);
  const incremental = await syncAccount(ctx);
  assert.equal(incremental.outcomes.processed, 1);
  const spotifyAfter = byProvider(
    await repo.listSubscriptions(ctx.accountId),
    "spotify",
  );
  assert.equal(spotifyAfter.id, spotify.id, "updated in place, not duplicated");
  assert.equal(spotifyAfter.status, "active");
  assert.equal(spotifyAfter.isTrial, false);
  assert.equal(spotifyAfter.renewalDate, "2026-11-04");
  assert.equal(spotifyAfter.renewalDateEstimated, false);
  assert.equal(spotifyAfter.lastPaymentDate, "2026-10-04");
  assert.equal((await repo.listSubscriptions(ctx.accountId)).length, 2);

  // Rebuilding from history reproduces exactly what is stored.
  const rebuild = await rebuildAccountSubscriptions(
    repo,
    ctx.accountId,
    new Date("2026-10-05T00:00:00Z"),
  );
  assert.equal(rebuild.checked, 2);
  assert.deepEqual(rebuild.corrected, []);
}

/** Conflicting signals and low confidence go to review instead of being applied. */
export async function reviewScenario(repo: Repository): Promise<void> {
  const { source, ctx } = setup(repo, "acc_review");
  for (const m of INBOX) source.deliver(m);
  await syncAccount(ctx);

  source.deliver(
    mail({
      id: "m-netflix-confusing",
      from: "Netflix <info@account.netflix.com>",
      subject: "About your Netflix membership payment",
      text: "Your payment failed. Payment received. Amount: $17.99/month.",
      at: "2026-09-10T10:00:00Z",
    }),
  );
  source.deliver(
    mail({
      id: "m-acme-vague",
      from: "Acme Cloud <billing@acmecloud.io>",
      subject: "Account update",
      text: "Your plan will renew soon.",
      at: "2026-09-12T10:00:00Z",
    }),
  );
  const report = await syncAccount(ctx);
  assert.equal(report.outcomes.processed, 1);
  assert.equal(report.outcomes.needs_review, 1);

  const subs = await repo.listSubscriptions(ctx.accountId);
  assert.equal(subs.length, 2, "the vague email did not create a subscription");
  const netflix = byProvider(subs, "netflix");
  assert.equal(
    netflix.status,
    "cancelled",
    "ambiguous email did not change status",
  );
  assert.equal(netflix.needsReview, true);

  const reasons = (await repo.listOpenReviewItems(ctx.accountId))
    .map((r) => r.reason)
    .sort();
  assert.deepEqual(reasons, [
    "ambiguous_event_type",
    "low_classification_confidence",
  ]);
}

/** A payment platform receipt is attributed to the merchant, billed via the platform. */
export async function intermediaryScenario(repo: Repository): Promise<void> {
  const { source, ctx } = setup(repo, "acc_apple");
  source.deliver(
    mail({
      id: "m-apple-calm",
      from: "Apple <no_reply@email.apple.com>",
      subject: "Your receipt from Apple",
      text: "Your subscription to Calm Premium has been renewed.\nCalm Premium (Yearly) USD 69.99\nRenews November 3, 2026",
      at: "2026-09-20T10:00:00Z",
    }),
  );
  await syncAccount(ctx);
  const [calm] = await repo.listSubscriptions(ctx.accountId);
  assert.ok(calm);
  assert.equal(calm.providerName, "Calm");
  assert.equal(calm.billedVia, "Apple");
  assert.equal(calm.planName, "Premium");
  assert.equal(calm.billingFrequency, "annual");
  assert.deepEqual(calm.price, { amountMinor: 6999, currency: "USD" });
  assert.equal(calm.renewalDate, "2026-11-03");
  assert.equal(calm.status, "active");
}

/** Transient failures are recorded, then retried on the next sync. */
export async function retryScenario(repo: Repository): Promise<void> {
  const source = new FlakySource("memory");
  const ctx = { repo, source, accountId: "acc_flaky", now: steppingClock() };
  for (const m of INBOX) source.deliver(m);
  source.failNext("m-spotify-trial", 1);

  const first = await syncAccount(ctx);
  assert.equal(first.outcomes.failed, 1);
  const failed = await repo.getProcessedEmail(
    emailIdFor("acc_flaky", "memory", "m-spotify-trial"),
  );
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.attempts, 1);

  const second = await syncAccount(ctx);
  assert.equal(second.outcomes.processed, 1);
  const ok = await repo.getProcessedEmail(
    emailIdFor("acc_flaky", "memory", "m-spotify-trial"),
  );
  assert.equal(ok?.status, "processed");
  assert.equal(ok?.attempts, 2);
  const spotify = byProvider(
    await repo.listSubscriptions("acc_flaky"),
    "spotify",
  );
  assert.equal(spotify.status, "trialing");
}

/** When the provider's change history expires, a bounded rescan still catches new mail. */
export async function expiredHistoryScenario(repo: Repository): Promise<void> {
  const { source, ctx } = setup(repo, "acc_expired");
  for (const m of INBOX) source.deliver(m);
  await syncAccount(ctx);

  source.deliver(spotifyReceipt);
  source.expireHistory();
  const report = await syncAccount(ctx);
  assert.equal(report.fullRescan, true);
  assert.equal(report.outcomes.processed, 1);
  assert.equal(report.outcomes.failed, 0);
  assert.equal(
    byProvider(await repo.listSubscriptions(ctx.accountId), "spotify").status,
    "active",
  );
}

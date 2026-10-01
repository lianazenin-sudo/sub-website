import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryRepository } from "../src/persistence/in-memory-repository";
import { processMessage } from "../src/pipeline/process-email";
import { rebuildAccountSubscriptions } from "../src/pipeline/rebuild";
import { syncAccount } from "../src/pipeline/sync";
import { INBOX } from "./fixtures";
import { setup, stateOf } from "./helpers";
import {
  expiredHistoryScenario,
  initialScanScenario,
  intermediaryScenario,
  retryScenario,
  reviewScenario,
} from "./scenarios";

/** Deterministic shuffle (mulberry32) so failures are reproducible. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  let a = seed;
  const random = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

describe("pipeline (in-memory repository)", () => {
  it("initial scan, idempotent re-sync, incremental update and rebuild", () =>
    initialScanScenario(new InMemoryRepository()));
  it("sends ambiguous and low-confidence emails to review", () =>
    reviewScenario(new InMemoryRepository()));
  it("attributes payment-platform receipts to the merchant", () =>
    intermediaryScenario(new InMemoryRepository()));
  it("retries transient failures on the next sync", () =>
    retryScenario(new InMemoryRepository()));
  it("recovers when the provider change history expires", () =>
    expiredHistoryScenario(new InMemoryRepository()));

  it("gives the same result whatever order emails are processed in", async () => {
    const reference = new InMemoryRepository();
    const ref = setup(reference);
    for (const m of INBOX) ref.source.deliver(m);
    await syncAccount(ref.ctx);
    const expected = (await reference.listSubscriptions(ref.ctx.accountId))
      .map(stateOf)
      .sort((a, b) => a.providerName.localeCompare(b.providerName));

    for (const seed of [1, 2, 3, 4, 5]) {
      const repo = new InMemoryRepository();
      const { source, ctx } = setup(repo);
      for (const m of INBOX) source.deliver(m);
      for (const m of shuffled(INBOX, seed))
        await processMessage(ctx, m.providerMessageId);
      const actual = (await repo.listSubscriptions(ctx.accountId))
        .map(stateOf)
        .sort((a, b) => a.providerName.localeCompare(b.providerName));
      // lastEmailId can differ only through which copy of the duplicate receipt won; it's not the last event here.
      assert.deepEqual(actual, expected, `seed ${seed}`);
    }
  });

  it("never creates a second event for the same email, even if processing is forced twice", async () => {
    const repo = new InMemoryRepository();
    const { source, ctx } = setup(repo);
    for (const m of INBOX) source.deliver(m);
    await Promise.all([
      syncAccount(ctx),
      processMessage(ctx, "m-netflix-welcome"),
      processMessage(ctx, "m-netflix-welcome"),
    ]);
    const events = repo.allEvents(ctx.accountId);
    const emailIds = events.map((e) => e.emailId);
    assert.equal(new Set(emailIds).size, emailIds.length);
    assert.equal(events.length, 6);
  });

  it("keeps an audit entry linking every applied email to its subscription", async () => {
    const repo = new InMemoryRepository();
    const { source, ctx } = setup(repo);
    for (const m of INBOX) source.deliver(m);
    await syncAccount(ctx);
    const audit = repo.allAudit(ctx.accountId);
    const processed = repo
      .allProcessed(ctx.accountId)
      .filter((p) => p.status === "processed");
    assert.equal(audit.length, processed.length);
    for (const p of processed) {
      const entry = audit.find((a) => a.emailId === p.id);
      assert.ok(entry, `audit for ${p.providerMessageId}`);
      assert.equal(entry.subscriptionId, p.subscriptionId);
    }
    assert.equal(audit.filter((a) => a.action === "created").length, 2);
  });

  it("corrects a stored subscription that drifted from its history", async () => {
    const repo = new InMemoryRepository();
    const { source, ctx } = setup(repo);
    for (const m of INBOX) source.deliver(m);
    await syncAccount(ctx);
    const [first] = await repo.listSubscriptions(ctx.accountId);
    assert.ok(first);
    await repo.transaction(ctx.accountId, (tx) =>
      tx.saveSubscription({ ...first, status: "active", planName: "Tampered" }),
    );

    const report = await rebuildAccountSubscriptions(repo, ctx.accountId);
    assert.deepEqual(report.corrected, [first.id]);
    const restored = (await repo.listSubscriptions(ctx.accountId)).find(
      (s) => s.id === first.id,
    );
    assert.deepEqual(restored && stateOf(restored), stateOf(first));
  });

  it("rolls back every write of an email when a later step fails", async () => {
    const repo = new InMemoryRepository();
    const { source, ctx } = setup(repo);
    source.deliver(INBOX[0]!);
    const original = repo.transaction.bind(repo);
    // Make the subscription save fail inside the transaction.
    repo.transaction = (accountId, work) =>
      original(accountId, (tx) =>
        work({
          ...tx,
          saveSubscription: async () => {
            throw new Error("disk full");
          },
        }),
      );
    const outcome = await processMessage(ctx, "m-netflix-welcome");
    assert.equal(outcome.status, "failed");
    assert.equal(
      repo.allEvents(ctx.accountId).length,
      0,
      "event write was rolled back",
    );
    assert.equal((await repo.listSubscriptions(ctx.accountId)).length, 0);
    const ledger = repo.allProcessed(ctx.accountId);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.status, "failed");
    assert.match(ledger[0]?.lastError ?? "", /disk full/);
  });
});

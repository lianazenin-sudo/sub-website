/** Shared helpers for the pipeline tests. */
import { InMemoryEmailSource } from "../src/collector/in-memory-email-source";
import type {
  SubscriptionRecord,
  SubscriptionState,
} from "../src/domain/types";
import type { Repository } from "../src/persistence/repository";
import type { EngineContext } from "../src/pipeline/process-email";

/** A clock that starts at a fixed time and advances one second per call. */
export function steppingClock(start = "2026-10-01T12:00:00Z"): () => Date {
  let t = Date.parse(start);
  return () => {
    t += 1000;
    return new Date(t);
  };
}

/** Builds an engine context around a fresh in-memory mailbox. */
export function setup(
  repo: Repository,
  accountId = "acc_nana",
): { source: InMemoryEmailSource; ctx: EngineContext } {
  const source = new InMemoryEmailSource("memory");
  return { source, ctx: { repo, source, accountId, now: steppingClock() } };
}

/** Wraps a source so that getMessage() fails for chosen ids a set number of times. */
export class FlakySource extends InMemoryEmailSource {
  private readonly failuresLeft = new Map<string, number>();

  /** Makes the next `times` fetches of `id` throw. */
  failNext(id: string, times: number): void {
    this.failuresLeft.set(id, times);
  }

  override async getMessage(providerMessageId: string): Promise<unknown> {
    const left = this.failuresLeft.get(providerMessageId) ?? 0;
    if (left > 0) {
      this.failuresLeft.set(providerMessageId, left - 1);
      throw new Error("simulated provider timeout");
    }
    return super.getMessage(providerMessageId);
  }
}

/** Only the replay-derived fields of a subscription (no ids, no timestamps of processing). */
export function stateOf(
  s: SubscriptionRecord,
): Omit<SubscriptionState, "lastEventAt"> & { lastEventAt: string | null } {
  return {
    providerName: s.providerName,
    billedVia: s.billedVia,
    planName: s.planName,
    status: s.status,
    startDate: s.startDate,
    renewalDate: s.renewalDate,
    renewalDateEstimated: s.renewalDateEstimated,
    expirationDate: s.expirationDate,
    cancellationDate: s.cancellationDate,
    billingFrequency: s.billingFrequency,
    price: s.price,
    previousPrice: s.previousPrice,
    isTrial: s.isTrial,
    trialEndDate: s.trialEndDate,
    lastPaymentDate: s.lastPaymentDate,
    lastEmailId: s.lastEmailId,
    lastEventAt: s.lastEventAt?.toISOString() ?? null,
  };
}

/** Finds a subscription by provider key or fails loudly. */
export function byProvider(
  subs: SubscriptionRecord[],
  providerKey: string,
): SubscriptionRecord {
  const found = subs.find((s) => s.providerKey === providerKey);
  if (!found)
    throw new Error(
      `no subscription for ${providerKey}; have ${subs.map((s) => s.providerKey).join(", ")}`,
    );
  return found;
}

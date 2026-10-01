/**
 * Subscription Matcher stage: decides which existing subscription an event
 * belongs to, whether it starts a new one, or whether that can't be decided.
 *
 * Candidates are the account's subscriptions with the same provider key.
 * Rules, in order:
 *   1. No candidates                                   → new subscription
 *   2. Candidates with the same plan name              → pick among those
 *      ("Premium" and "Premium Individual" count as the same plan: emails
 *      often shorten the full plan name)
 *   3. A start/trial event for a plan that differs from
 *      every live subscription of this provider        → new subscription
 *   4. Otherwise                                       → pick among all candidates
 *
 * "Pick among": exactly one live subscription → that one; none live → the
 * most recently active (an old subscription coming back to life); several
 * live → ambiguous, flagged for review instead of guessing.
 */
import type {
  ExtractedSubscriptionData,
  SubscriptionEventType,
  SubscriptionRecord,
  SubscriptionStatus,
} from "../domain/types";

export type MatchResult =
  | { kind: "existing"; subscription: SubscriptionRecord }
  | { kind: "new" }
  | { kind: "ambiguous"; candidateIds: string[] };

/** Statuses of a subscription that is still running (or might be). */
const LIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "active",
  "trialing",
  "past_due",
  "unknown",
]);

/** Normalizes a plan name for comparison ("Premium  Family" → "premiumfamily"). */
export function planKeyOf(planName: string | null): string | null {
  if (!planName) return null;
  const key = planName
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]/g, "");
  return key.length > 0 ? key : null;
}

/**
 * True when two plan keys describe the same plan: equal, or one is a shorter
 * form of the other ("premium" / "premiumindividual").
 */
export function plansCompatible(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/** Chooses between candidate subscriptions using the "pick among" rule above. */
function pickAmong(candidates: SubscriptionRecord[]): MatchResult {
  const live = candidates.filter((c) => LIVE_STATUSES.has(c.status));
  if (live.length === 1 && live[0])
    return { kind: "existing", subscription: live[0] };
  if (live.length === 0) {
    const mostRecent = [...candidates].sort(
      (a, b) =>
        (b.lastEventAt?.getTime() ?? 0) - (a.lastEventAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id),
    )[0];
    if (mostRecent) return { kind: "existing", subscription: mostRecent };
  }
  return {
    kind: "ambiguous",
    candidateIds: candidates.map((c) => c.id).sort(),
  };
}

/**
 * Matches extracted email data to one of `candidates` (the account's
 * subscriptions for the same provider). See the rules at the top of the file.
 */
export function matchSubscription(
  candidates: SubscriptionRecord[],
  data: ExtractedSubscriptionData,
  eventType: SubscriptionEventType,
): MatchResult {
  if (candidates.length === 0) return { kind: "new" };

  const planKey = planKeyOf(data.planName);
  if (planKey) {
    const samePlan = candidates.filter((c) => {
      const candidateKey = planKeyOf(c.planName);
      return candidateKey !== null && plansCompatible(candidateKey, planKey);
    });
    if (samePlan.length > 0) return pickAmong(samePlan);

    const startsSomething =
      eventType === "subscription_started" || eventType === "trial_started";
    const live = candidates.filter((c) => LIVE_STATUSES.has(c.status));
    // samePlan is empty here, so every live candidate with a known plan has a different plan.
    const allLiveHaveOtherPlans =
      live.length > 0 && live.every((c) => planKeyOf(c.planName) !== null);
    if (startsSomething && allLiveHaveOtherPlans) return { kind: "new" };
  }

  return pickAmong(candidates);
}

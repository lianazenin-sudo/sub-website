/**
 * Reconstructs subscription state from the processing history.
 *
 * Because each subscription is a projection of its stored events, the
 * subscriptions table can be recomputed at any time, e.g. after fixing a bug
 * in the replay rules or to verify nothing drifted. Events, audit entries and
 * the email ledger are never modified here.
 *
 * (Re-deriving the events themselves would require re-reading the emails,
 * since bodies are deliberately not stored: delete the affected ledger rows
 * and events, then run a sync to re-fetch and re-analyse them.)
 */
import type { Repository } from "../persistence/repository";
import type { SubscriptionRecord } from "../domain/types";
import { diffSubscription, projectSubscription } from "../state/project";
import { identityOf, logEntry, reviewItemsFromFindings } from "./records";

export interface RebuildReport {
  checked: number;
  /** Ids of subscriptions whose stored state differed from the replay and was corrected. */
  corrected: string[];
}

/**
 * Re-projects every subscription of an account from its events and saves
 * any that differ from what is stored. Each subscription is rebuilt in its
 * own transaction.
 */
export async function rebuildAccountSubscriptions(
  repo: Repository,
  accountId: string,
  now: Date = new Date(),
): Promise<RebuildReport> {
  const report: RebuildReport = { checked: 0, corrected: [] };
  for (const subscriptionId of await repo.listSubscriptionIds(accountId)) {
    await repo.transaction(accountId, async (tx) => {
      const stored = await tx.getSubscription(subscriptionId);
      const events = await tx.listEventsForSubscription(subscriptionId);
      if (!stored || events.length === 0) return;
      report.checked += 1;

      const { state, findings } = projectSubscription(events);
      await tx.upsertReviewItems(
        reviewItemsFromFindings(findings, accountId, subscriptionId, now),
      );
      const needsReview = await tx.hasOpenReviewItems(subscriptionId);
      const rebuilt: SubscriptionRecord = {
        ...identityOf(stored),
        ...state,
        needsReview,
        updatedAt: stored.updatedAt,
      };

      const changes = diffSubscription(stored, rebuilt);
      if (Object.keys(changes).length === 0) return;
      await tx.saveSubscription({ ...rebuilt, updatedAt: now });
      await tx.appendLog(
        logEntry(
          accountId,
          null,
          "warn",
          "rebuild",
          "Stored subscription differed from its history; corrected",
          { subscriptionId, changedFields: Object.keys(changes) },
          now,
        ),
      );
      report.corrected.push(subscriptionId);
    });
  }
  return report;
}

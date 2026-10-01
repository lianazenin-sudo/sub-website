/**
 * Subscription state is a pure function of its events.
 *
 * Instead of mutating a subscription in place, every update re-plays all of
 * the subscription's events in date order. That gives three guarantees:
 *   - Order independence: the initial scan reads newest-first, and a late
 *     email can arrive out of order; the result is the same either way.
 *   - Reconstructability: the stored events fully determine the stored
 *     subscription, so it can be rebuilt at any time (see pipeline/rebuild.ts).
 *   - Idempotency: replaying the same events always gives the same state.
 *
 * Conflicts found during replay are returned as findings (review reasons);
 * the replay itself never guesses its way past them.
 */
import { addDays, addMonths, toDateOnly } from "../domain/date-only";
import { moneyEquals } from "../domain/money";
import type {
  BillingFrequency,
  DateOnly,
  ReviewReason,
  SubscriptionEvent,
  SubscriptionRecord,
  SubscriptionState,
} from "../domain/types";

export interface ReviewFinding {
  eventId: string;
  emailId: string;
  reason: ReviewReason;
  details: Record<string, unknown>;
}

export interface Projection {
  state: SubscriptionState;
  findings: ReviewFinding[];
}

/** Starting point before any event is applied. */
export function emptyState(providerName: string): SubscriptionState {
  return {
    providerName,
    billedVia: null,
    planName: null,
    status: "unknown",
    startDate: null,
    renewalDate: null,
    renewalDateEstimated: false,
    expirationDate: null,
    cancellationDate: null,
    billingFrequency: null,
    price: null,
    previousPrice: null,
    isTrial: false,
    trialEndDate: null,
    lastPaymentDate: null,
    lastEmailId: null,
    lastEventAt: null,
  };
}

/** Orders events by when the email was received, then by id for full determinism. */
export function sortEvents(
  events: readonly SubscriptionEvent[],
): SubscriptionEvent[] {
  return [...events].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}

/** Estimates the next renewal from a payment date and billing cycle. */
export function estimateNextRenewal(
  paidOn: DateOnly,
  frequency: BillingFrequency,
): DateOnly {
  switch (frequency) {
    case "weekly":
      return addDays(paidOn, 7);
    case "monthly":
      return addMonths(paidOn, 1);
    case "quarterly":
      return addMonths(paidOn, 3);
    case "semiannual":
      return addMonths(paidOn, 6);
    case "annual":
      return addMonths(paidOn, 12);
  }
}

/** Normalizes a plan name for the "is this just a shorter version?" check. */
function planKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9+]/g, "");
}

/**
 * Updates descriptive fields (provider, plan, cycle, price) from an event.
 * A plan name that is just a shorter form of the current one ("Premium" vs
 * "Premium Individual") doesn't replace it, unless the event is a plan change.
 * A price in a different currency is a conflict, not an update.
 */
function applyDescriptiveFields(
  s: SubscriptionState,
  event: SubscriptionEvent,
  findings: ReviewFinding[],
): void {
  const d = event.data;
  s.providerName = d.providerName;
  if (d.billedVia) s.billedVia = d.billedVia;
  if (d.billingFrequency) s.billingFrequency = d.billingFrequency;
  if (d.planName) {
    const shorterForm =
      s.planName !== null &&
      planKey(s.planName).startsWith(planKey(d.planName));
    if (!shorterForm || event.type === "plan_changed") s.planName = d.planName;
  }

  if (!d.price || event.reviewReasons.includes("ambiguous_price")) return;
  const priceEvent =
    event.type === "plan_changed" || event.type === "price_changed";
  if (s.price && s.price.currency !== d.price.currency && !priceEvent) {
    findings.push({
      eventId: event.id,
      emailId: event.emailId,
      reason: "currency_conflict",
      details: { current: s.price, incoming: d.price },
    });
    return;
  }
  if (event.type === "price_changed" && d.previousPrice)
    s.previousPrice = d.previousPrice;
  else if (s.price && !moneyEquals(s.price, d.price)) s.previousPrice = s.price;
  s.price = d.price;
}

/** Records that a reminder arrived for a subscription that had already ended. */
function flagActivityAfterEnd(
  s: SubscriptionState,
  event: SubscriptionEvent,
  findings: ReviewFinding[],
): void {
  findings.push({
    eventId: event.id,
    emailId: event.emailId,
    reason: "activity_after_cancellation",
    details: { eventType: event.type, statusAtTheTime: s.status },
  });
}

/** Clears end-of-life fields when an ended subscription starts again. */
function reactivate(s: SubscriptionState): void {
  s.cancellationDate = null;
  s.expirationDate = null;
}

/** Sets an explicit renewal date when the email states one. */
function setStatedRenewal(
  s: SubscriptionState,
  renewalDate: DateOnly | null,
): void {
  if (renewalDate) {
    s.renewalDate = renewalDate;
    s.renewalDateEstimated = false;
  }
}

/**
 * Applies one event to a state and returns the new state (the input is not
 * modified). Findings (conflicts) are appended to `findings`.
 */
export function applyEvent(
  previous: SubscriptionState,
  event: SubscriptionEvent,
  findings: ReviewFinding[],
): SubscriptionState {
  const s: SubscriptionState = { ...previous };
  const d = event.data;
  const day = toDateOnly(event.occurredAt);
  const ended = s.status === "cancelled" || s.status === "expired";

  for (const reason of event.reviewReasons) {
    findings.push({
      eventId: event.id,
      emailId: event.emailId,
      reason,
      details: { eventType: event.type },
    });
  }
  s.lastEmailId = event.emailId;
  s.lastEventAt = event.occurredAt;
  applyDescriptiveFields(s, event, findings);

  // If we can't tell what the email meant, it may describe the subscription
  // but must not change its status or dates.
  if (event.reviewReasons.includes("ambiguous_event_type")) return s;

  switch (event.type) {
    case "subscription_started":
      if (ended) {
        reactivate(s);
        s.startDate = d.startDate ?? day;
      } else {
        s.startDate = d.startDate ?? s.startDate ?? day;
      }
      s.status = d.isTrial ? "trialing" : "active";
      s.isTrial = d.isTrial;
      if (d.trialEndDate) s.trialEndDate = d.trialEndDate;
      setStatedRenewal(s, d.renewalDate);
      break;

    case "trial_started":
      if (ended) reactivate(s);
      s.status = "trialing";
      s.isTrial = true;
      s.startDate = d.startDate ?? (ended ? day : (s.startDate ?? day));
      if (d.trialEndDate) s.trialEndDate = d.trialEndDate;
      break;

    case "trial_ending":
      if (ended) {
        flagActivityAfterEnd(s, event, findings);
      } else {
        s.status = "trialing";
        s.isTrial = true;
        if (d.trialEndDate) s.trialEndDate = d.trialEndDate;
      }
      break;

    case "renewal_reminder":
      if (ended) {
        flagActivityAfterEnd(s, event, findings);
      } else {
        if (s.status === "unknown") s.status = "active";
        setStatedRenewal(s, d.renewalDate);
      }
      break;

    case "payment_succeeded":
      // A successful charge is strong evidence the subscription is running,
      // including after an earlier cancellation (the user resubscribed).
      if (ended) reactivate(s);
      s.status = "active";
      s.isTrial = false;
      s.lastPaymentDate = d.paymentDate ?? day;
      if (d.renewalDate) {
        setStatedRenewal(s, d.renewalDate);
      } else if (s.billingFrequency) {
        s.renewalDate = estimateNextRenewal(
          s.lastPaymentDate,
          s.billingFrequency,
        );
        s.renewalDateEstimated = true;
      }
      break;

    case "payment_failed":
      if (!ended) s.status = "past_due";
      break;

    case "plan_changed":
    case "price_changed":
      if (s.status === "unknown") s.status = "active";
      if (!ended) setStatedRenewal(s, d.renewalDate);
      break;

    case "cancelled":
      s.status = "cancelled";
      s.cancellationDate = d.cancellationDate ?? day;
      if (d.expirationDate) s.expirationDate = d.expirationDate;
      s.renewalDate = null;
      s.renewalDateEstimated = false;
      break;

    case "expiring":
      if (d.expirationDate) s.expirationDate = d.expirationDate;
      if (s.status === "unknown") s.status = "active";
      break;

    case "expired":
      s.status = "expired";
      s.expirationDate = d.expirationDate ?? s.expirationDate ?? day;
      s.renewalDate = null;
      s.renewalDateEstimated = false;
      break;
  }
  return s;
}

/** Replays a subscription's events (in date order) into its current state. */
export function projectSubscription(
  events: readonly SubscriptionEvent[],
): Projection {
  const ordered = sortEvents(events);
  const first = ordered[0];
  if (!first) throw new Error("Cannot project a subscription with no events");
  const findings: ReviewFinding[] = [];
  let state = emptyState(first.data.providerName);
  for (const event of ordered) state = applyEvent(state, event, findings);
  return { state, findings };
}

/** Fields compared when recording what an email changed. */
const AUDITED_FIELDS = [
  "providerName",
  "billedVia",
  "planName",
  "status",
  "startDate",
  "renewalDate",
  "renewalDateEstimated",
  "expirationDate",
  "cancellationDate",
  "billingFrequency",
  "price",
  "previousPrice",
  "isTrial",
  "trialEndDate",
  "lastPaymentDate",
  "needsReview",
] as const satisfies ReadonlyArray<keyof SubscriptionRecord>;

/**
 * Lists the fields that differ between two versions of a subscription, as
 * { field: { from, to } }. With no previous version every field is "new".
 */
export function diffSubscription(
  before: SubscriptionRecord | null,
  after: SubscriptionRecord,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of AUDITED_FIELDS) {
    const from = before ? before[field] : null;
    const to = after[field];
    if (JSON.stringify(from) !== JSON.stringify(to))
      changes[field] = { from, to };
  }
  return changes;
}

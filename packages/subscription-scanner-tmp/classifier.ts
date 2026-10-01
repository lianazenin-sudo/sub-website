/**
 * Subscription Classifier stage.
 *
 * Decides (1) whether an email is a subscription event at all and (2) which
 * event it is. Fully rule-based and deterministic: no external service sees
 * the email, and the same email always gets the same answer for a given
 * rulesVersion.
 *
 * Scoring:
 *   event score  = phrase matches for the best event type (+4 subject, +2 body, max 10)
 *   + context    = subscription vocabulary, a price, a billing period, a known provider
 *   − penalties  = marketing, newsletters, security codes, shipping, social,
 *                  replies/forwards, personal mailboxes, Gmail promo/social tabs,
 *                  and payment-type events with no sign of anything recurring
 *
 *   final score < ignoreBelow → ignore;  < acceptAt → review;  otherwise accept.
 */
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import type {
  ClassificationResult,
  NormalizedEmail,
  SubscriptionEventType,
} from "../domain/types";
import { SUBSCRIPTION_EVENT_TYPES } from "../domain/types";
import { containsMoney } from "../extractor/amounts";
import { countFrequencyMentions } from "../extractor/frequency";
import { isKnownSubscriptionSender } from "../extractor/provider";
import {
  COMPATIBLE_EVENT_PAIRS,
  EVENT_PATTERNS,
  EVENT_PRECEDENCE,
  EVENTS_NEEDING_RECURRING_CONTEXT,
  FREE_MAIL_DOMAINS,
  LABEL_PENALTIES,
  NEGATIVE_RULES,
  PERSONAL_SUBJECT,
  SUBSCRIPTION_LEXICON,
} from "./rules";

const SUBJECT_HIT = 4;
const BODY_HIT = 2;
const MAX_EVENT_SCORE = 10;
/** The winning event type needs at least one real phrase match. */
const MIN_EVENT_SCORE = 2;

interface RankedEvent {
  type: SubscriptionEventType;
  score: number;
}

/** Scores every event type by how many of its phrases appear in subject and body. */
export function scoreEventTypes(subject: string, body: string): RankedEvent[] {
  return SUBSCRIPTION_EVENT_TYPES.map((type) => {
    let score = 0;
    for (const pattern of EVENT_PATTERNS[type]) {
      if (pattern.test(subject)) score += SUBJECT_HIT;
      if (pattern.test(body)) score += BODY_HIT;
    }
    return { type, score: Math.min(score, MAX_EVENT_SCORE) };
  });
}

/** Sorts event types by score, breaking ties with EVENT_PRECEDENCE. */
function rankEvents(events: RankedEvent[]): RankedEvent[] {
  const rank = (t: SubscriptionEventType): number =>
    EVENT_PRECEDENCE.indexOf(t);
  return events
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || rank(a.type) - rank(b.type));
}

/** True when two event types can legitimately appear in the same email. */
export function areCompatible(
  a: SubscriptionEventType,
  b: SubscriptionEventType,
): boolean {
  return (
    a === b ||
    COMPATIBLE_EVENT_PAIRS.some(
      ([x, y]) => (x === a && y === b) || (x === b && y === a),
    )
  );
}

/** Bonus points for signs that the email is about something recurring. */
function contextScore(
  email: NormalizedEmail,
  signals: string[],
): { score: number; recurring: boolean; hasMoney: boolean } {
  let score = 0;
  const lexiconInSubject = SUBSCRIPTION_LEXICON.test(email.subject);
  const lexiconInBody = SUBSCRIPTION_LEXICON.test(email.text);
  if (lexiconInSubject) score += 2;
  if (lexiconInBody) score += 1;
  if (lexiconInSubject || lexiconInBody)
    signals.push("subscription_vocabulary");

  const fullText = `${email.subject}\n${email.text}`;
  const hasMoney = containsMoney(fullText);
  if (hasMoney) {
    score += 1;
    signals.push("has_amount");
  }
  const hasFrequency = countFrequencyMentions(fullText).size > 0;
  if (hasFrequency) {
    score += 1;
    signals.push("has_billing_period");
  }
  if (isKnownSubscriptionSender(email.from.domain)) {
    score += 1;
    signals.push("known_provider");
  }
  return {
    score,
    recurring: lexiconInSubject || lexiconInBody || hasFrequency,
    hasMoney,
  };
}

/** Penalty points for signs that the email is marketing, personal or unrelated. */
function penaltyScore(
  email: NormalizedEmail,
  hasMoney: boolean,
  signals: string[],
): number {
  let penalty = 0;
  for (const rule of NEGATIVE_RULES) {
    let weight = 0;
    if (rule.re.test(email.subject)) weight += rule.subjectWeight;
    if (rule.re.test(email.text)) weight += rule.bodyWeight;
    // A newsletter "subscription" with no price is a free mailing list, not a paid service.
    if (rule.label === "newsletter" && weight > 0 && !hasMoney)
      weight = Math.max(weight, 5);
    if (weight > 0) {
      penalty += weight;
      signals.push(`-${rule.label}`);
    }
  }
  if (PERSONAL_SUBJECT.test(email.subject)) {
    penalty += 4;
    signals.push("-reply_or_forward");
  }
  if (FREE_MAIL_DOMAINS.has(email.from.domain)) {
    penalty += 4;
    signals.push("-personal_mailbox");
  }
  for (const label of email.labels) {
    const labelPenalty = LABEL_PENALTIES[label];
    if (labelPenalty) {
      penalty += labelPenalty;
      signals.push(`-label:${label}`);
    }
  }
  return penalty;
}

/**
 * Classifies one email. Returns the decision (accept / review / ignore), the
 * event type, the score, any conflicting runner-up, and the signals that
 * produced the score.
 */
export function classifyEmail(
  email: NormalizedEmail,
  thresholds: EngineConfig["classification"] = DEFAULT_ENGINE_CONFIG.classification,
): ClassificationResult {
  const signals: string[] = [];
  const ranked = rankEvents(scoreEventTypes(email.subject, email.text));
  const best = ranked[0];

  if (!best || best.score < MIN_EVENT_SCORE) {
    return {
      decision: "ignore",
      eventType: null,
      score: 0,
      eventScore: best?.score ?? 0,
      runnerUp: null,
      ambiguous: false,
      signals: ["no_event_phrases"],
    };
  }
  signals.push(`event:${best.type}=${best.score}`);

  const context = contextScore(email, signals);
  let score =
    best.score + context.score - penaltyScore(email, context.hasMoney, signals);

  if (EVENTS_NEEDING_RECURRING_CONTEXT.has(best.type) && !context.recurring) {
    score -= 4;
    signals.push("-no_recurring_context");
  }

  // A conflicting event type almost as strong as the winner means we can't
  // tell what happened (e.g. "payment failed" and "payment received" together).
  const conflict = ranked.find(
    (e) =>
      e !== best &&
      e.score >= best.score - thresholds.ambiguityMargin &&
      !areCompatible(best.type, e.type),
  );
  if (conflict) signals.push(`conflict:${conflict.type}=${conflict.score}`);

  const decision =
    score < thresholds.ignoreBelow
      ? "ignore"
      : score < thresholds.acceptAt
        ? "review"
        : "accept";
  return {
    decision,
    eventType: best.type,
    score,
    eventScore: best.score,
    runnerUp: conflict
      ? { eventType: conflict.type, score: conflict.score }
      : null,
    ambiguous: conflict !== undefined,
    signals,
  };
}

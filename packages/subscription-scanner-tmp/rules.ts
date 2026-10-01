/**
 * Rule tables for the Subscription Classifier.
 *
 * Kept apart from the scoring code so rules can be reviewed, tested and
 * extended without touching the algorithm. Regexes here deliberately have no
 * `g` flag: they are used with .test(), which is stateful with `g`.
 *
 * English only for now. Adding a language means adding patterns here.
 */
import type { SubscriptionEventType } from "../domain/types";

/**
 * Phrases that indicate each event type. Every pattern scores +4 when found
 * in the subject and +2 in the body (see classifier.ts).
 */
export const EVENT_PATTERNS: Readonly<
  Record<SubscriptionEventType, readonly RegExp[]>
> = {
  subscription_started: [
    /\bthanks?(?: you)? for (?:subscribing|joining|your subscription|signing up for)\b/i,
    /\byou(?:'re| are) (?:now )?subscribed\b/i,
    /\b(?:subscription|membership)(?: is| has been)? (?:confirmed|activated|now active)\b/i,
    /\b(?:subscription|membership) (?:has )?(?:started|begun)\b/i,
    /\bwelcome to (?:your )?\S+(?: \S+)? (?:premium|plus|pro|membership|subscription)\b/i,
    /\byou(?:'ve| have) (?:successfully )?(?:subscribed|joined|signed up for)\b/i,
    /\bsubscription confirmation\b/i,
  ],
  trial_started: [
    /\btrial (?:has )?(?:started|begun|is (?:now )?active)\b/i,
    /\b(?:welcome to|enjoy) your (?:free )?trial\b/i,
    /\byou(?:'ve| have) started (?:a|your) (?:free )?trial\b/i,
    /\btrial (?:period )?(?:confirmation|activated)\b/i,
  ],
  trial_ending: [
    /\btrial (?:ends|is ending|will end|expires|will expire|is about to end|ending soon|ends soon)\b/i,
    /\b(?:end|last day) of your (?:free )?trial\b/i,
    /\b(?:\d+|one|two|three|a few) days? left (?:in|on) your (?:free )?trial\b/i,
  ],
  renewal_reminder: [
    // Lookbehinds keep "will not renew on" / "doesn't renew on" out of this event.
    /\b(?:will (?:automatically )?renew|(?<!not |n't )renews? (?:on|automatically|soon))\b/i,
    /\bupcoming (?:renewal|payment|charge|bill)\b/i,
    /\brenewal (?:reminder|notice)\b/i,
    /\b(?:due for|coming up for) renewal\b/i,
    /(?<!not |n't )\b(?:will|you'll|you will) be (?:charged|billed)\b/i,
    /\bnext (?:billing|payment|charge) (?:date|is|will)\b/i,
  ],
  payment_succeeded: [
    /\bpayment (?:received|successful|confirmation|confirmed|processed)\b/i,
    /\bthanks?(?: you)? for your (?:payment|purchase|order)\b/i,
    /\b(?:we(?:'ve| have)|has been|was) (?:successfully )?(?:charged|billed)\b/i,
    /\byour (?:\S+ ){0,3}(?:receipt|invoice)\b/i,
    /\breceipt (?:for|from)\b/i,
    /\b(?:subscription|membership) (?:has been |was |is )?(?:successfully )?renewed\b/i,
    /\bhas been (?:successfully )?renewed\b/i,
    /\b(?:renewal|payment) (?:confirmation|successful|complete)\b/i,
    /\bamount (?:paid|charged)\b/i,
  ],
  payment_failed: [
    /\bpayment (?:failed|declined|was declined|unsuccessful|was unsuccessful|could not be (?:processed|completed)|issue|problem)\b/i,
    /\b(?:couldn't|could not|were unable to|was unable to|unable to) (?:process|charge|complete|collect) (?:your |the )?(?:payment|card)\b/i,
    /\b(?:card|payment method) (?:was |has been )?declined\b/i,
    /\bupdate (?:your )?(?:payment|billing) (?:method|info|information|details)\b/i,
    /\b(?:past due|overdue)\b/i,
  ],
  plan_changed: [
    /\b(?:plan|subscription|membership) (?:has been |was |is )?(?:changed|updated|upgraded|downgraded|switched)\b/i,
    /\byou(?:'ve| have) (?:successfully )?(?:upgraded|downgraded|switched|changed) (?:to|your)\b/i,
    /\b(?:upgrade|downgrade|plan change) (?:confirmation|confirmed|complete)\b/i,
    /\bswitched (?:you )?to (?:the )?\S+ plan\b/i,
  ],
  price_changed: [
    /\bprice (?:change|increase|update|adjustment)s?\b/i,
    /\b(?:changes?|updates?|increase) to your (?:\S+ )?(?:price|pricing|subscription price|plan price|membership price)\b/i,
    /\b(?:new|updated) (?:price|pricing)\b/i,
    /\bprice (?:is|will be) (?:going up|increasing|changing|changed)\b/i,
    /\bprice will (?:change|increase|go up)\b/i,
  ],
  cancelled: [
    /\b(?:subscription|membership|plan|trial)(?: has been| was| is| has)? (?:cancell?ed|terminated)\b/i,
    /\bcancell?ation (?:confirmation|confirmed|request (?:received|processed|complete))\b/i,
    /\byou(?:'ve| have) (?:successfully )?cancell?ed\b/i,
    /\bwe(?:'ve| have) cancell?ed\b/i,
    /\bsorry to see you go\b/i,
    /\b(?:will not|won't) (?:be )?(?:automatically )?renew(?:ed)?\b/i,
    /\bauto-?renew(?:al)? (?:has been |is |was )?(?:turned off|disabled|cancell?ed|off)\b/i,
  ],
  expiring: [
    /\b(?:subscription|membership|plan|access) (?:will expire|expires|is expiring|is about to expire|will end|ends)\b/i,
    /\bexpir(?:es|ing) (?:on|soon|in)\b/i,
  ],
  expired: [
    /\b(?:subscription|membership|plan|trial|access) (?:has )?(?:expired|ended|lapsed)\b/i,
    /\b(?:expired on|no longer active|you no longer have access)\b/i,
  ],
};

export interface NegativeRule {
  label: string;
  re: RegExp;
  subjectWeight: number;
  bodyWeight: number;
}

/**
 * Signs that an email is not a subscription event even though it may use
 * the same words: marketing, newsletters, security codes, shipping, social.
 * Win-back phrases only count in the subject, because real cancellation
 * confirmations often include a "restart your membership" button.
 */
export const NEGATIVE_RULES: readonly NegativeRule[] = [
  {
    label: "promotional",
    re: /\b(?:\d{1,2}% off|sale ends|limited[- ]time|shop now|flash sale|exclusive offer|save up to|promo code|coupon|discount code|black friday|cyber monday|special offer|deal ends)\b/i,
    subjectWeight: 3,
    bodyWeight: 2,
  },
  {
    label: "subscription_marketing",
    re: /\b(?:subscribe (?:now|today)|start (?:your|a) free trial|try \S+(?: \S+)? (?:free|for free)|upgrade (?:now|today)|get \d+ months? (?:free|of|for))\b/i,
    subjectWeight: 4,
    bodyWeight: 2,
  },
  {
    label: "winback",
    re: /\b(?:we miss you|come back|rejoin|resubscribe|restart your (?:membership|subscription))\b/i,
    subjectWeight: 4,
    bodyWeight: 0,
  },
  {
    label: "newsletter",
    re: /\b(?:newsletter|mailing list|digest|weekly (?:roundup|recap)|email updates)\b/i,
    subjectWeight: 4,
    bodyWeight: 2,
  },
  {
    label: "security",
    re: /\b(?:verification code|one[- ]time (?:pass(?:word|code)|code)|otp|password reset|reset your password|new sign[- ]in|sign-?in attempt|security alert|verify your (?:email|account)|confirm your email)\b/i,
    subjectWeight: 5,
    bodyWeight: 3,
  },
  {
    label: "shipping",
    re: /\b(?:has shipped|out for delivery|tracking number|your package|has been delivered)\b/i,
    subjectWeight: 3,
    bodyWeight: 2,
  },
  {
    label: "social",
    re: /\b(?:commented on|liked your|mentioned you|tagged you|new follower|friend request|sent you a message)\b/i,
    subjectWeight: 3,
    bodyWeight: 2,
  },
];

/** Words that show an email is about a recurring arrangement. */
export const SUBSCRIPTION_LEXICON =
  /\b(?:subscription|subscriptions|membership|auto-?renew(?:al|s)?|recurring|billing (?:period|cycle)|free trial|your plan|renewal|renews)\b/i;

/** Subjects of replies and forwards: personal conversation, not a service email. */
export const PERSONAL_SUBJECT = /^\s*(?:re|fwd?|fw|aw|tr)\s*:/i;

/** Consumer mailbox domains: emails from these are from people, not services. */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "zoho.com",
  "yandex.com",
  "mail.com",
]);

/** Gmail category labels and how strongly they suggest "not a subscription event". */
export const LABEL_PENALTIES: Readonly<Record<string, number>> = {
  CATEGORY_PROMOTIONS: 2,
  CATEGORY_SOCIAL: 3,
  CATEGORY_FORUMS: 3,
};

/**
 * Event types that are only subscription-related with recurring context.
 * A one-off Uber receipt is a "payment" but not a subscription payment.
 */
export const EVENTS_NEEDING_RECURRING_CONTEXT: ReadonlySet<SubscriptionEventType> =
  new Set([
    "payment_succeeded",
    "payment_failed",
    "price_changed",
    "plan_changed",
  ]);

/**
 * Event types that commonly appear together in one email without
 * contradicting each other ("Your trial ends Oct 4; you'll be charged…").
 * Any other pair scoring within the ambiguity margin is a conflict.
 */
export const COMPATIBLE_EVENT_PAIRS: ReadonlyArray<
  readonly [SubscriptionEventType, SubscriptionEventType]
> = [
  ["trial_ending", "renewal_reminder"],
  ["trial_started", "subscription_started"],
  ["trial_started", "trial_ending"],
  ["trial_started", "renewal_reminder"],
  ["subscription_started", "payment_succeeded"],
  ["subscription_started", "renewal_reminder"],
  ["plan_changed", "payment_succeeded"],
  ["plan_changed", "renewal_reminder"],
  ["payment_succeeded", "renewal_reminder"],
  ["price_changed", "renewal_reminder"],
  ["price_changed", "plan_changed"],
  ["expiring", "renewal_reminder"],
  ["cancelled", "expiring"],
  ["cancelled", "expired"],
  ["expired", "trial_ending"],
];

/** Tie-break order when two compatible event types score the same (most specific first). */
export const EVENT_PRECEDENCE: readonly SubscriptionEventType[] = [
  "cancelled",
  "payment_failed",
  "expired",
  "price_changed",
  "plan_changed",
  "trial_started",
  "trial_ending",
  "subscription_started",
  "payment_succeeded",
  "renewal_reminder",
  "expiring",
];

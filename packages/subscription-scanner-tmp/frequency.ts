/**
 * Detects how often a subscription bills (weekly, monthly, …).
 *
 * The most reliable signal is a period written right after the price
 * ("$9.99/month"). Otherwise the most frequently mentioned period wins, and
 * a tie means "unknown" rather than a guess.
 */
import type { BillingFrequency } from "../domain/types";

const FREQUENCY_RULES: ReadonlyArray<{
  frequency: BillingFrequency;
  re: RegExp;
}> = [
  {
    frequency: "weekly",
    re: /\b(?:weekly|per week|every week|a week|each week)\b|\/\s?(?:wk|week)\b/gi,
  },
  {
    frequency: "monthly",
    re: /\b(?:monthly|per month|every month|a month|each month|month-to-month)\b|\/\s?(?:mo|mth|month)\b/gi,
  },
  {
    frequency: "quarterly",
    re: /\b(?:quarterly|per quarter|every (?:3|three) months)\b/gi,
  },
  {
    frequency: "semiannual",
    re: /\b(?:semi-?annual(?:ly)?|half-?yearly|bi-?annual(?:ly)?|every (?:6|six) months)\b/gi,
  },
  {
    // The lookbehind stops "semi-annual" / "bi-annual" from also counting as annual.
    frequency: "annual",
    re: /(?<!semi-|bi-)\b(?:annual(?:ly)?|yearly|per year|every year|a year|each year|per annum)\b|\/\s?(?:yr|year)\b/gi,
  },
];

/**
 * Returns the billing period written within 20 characters after a price
 * ("$9.99/month", "9.99 USD per year"), or null if there isn't one.
 */
export function frequencyNear(
  text: string,
  priceEnd: number,
): BillingFrequency | null {
  const window = text.slice(priceEnd, priceEnd + 20);
  let best: { frequency: BillingFrequency; index: number } | null = null;
  for (const rule of FREQUENCY_RULES) {
    for (const match of window.matchAll(rule.re)) {
      const index = match.index ?? 0;
      if (!best || index < best.index)
        best = { frequency: rule.frequency, index };
    }
  }
  return best?.frequency ?? null;
}

/** Counts how many times each billing period is mentioned anywhere in the text. */
export function countFrequencyMentions(
  text: string,
): Map<BillingFrequency, number> {
  const counts = new Map<BillingFrequency, number>();
  for (const rule of FREQUENCY_RULES) {
    const n = [...text.matchAll(rule.re)].length;
    if (n > 0) counts.set(rule.frequency, n);
  }
  return counts;
}

/**
 * Picks the billing frequency: the period next to the chosen price if there
 * is one, otherwise the single most-mentioned period, otherwise null.
 */
export function extractBillingFrequency(
  text: string,
  priceEnd: number | null,
): BillingFrequency | null {
  if (priceEnd !== null) {
    const near = frequencyNear(text, priceEnd);
    if (near) return near;
  }
  const ranked = [...countFrequencyMentions(text).entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const [first, second] = ranked;
  if (!first) return null;
  if (second && second[1] === first[1]) return null;
  return first[0];
}

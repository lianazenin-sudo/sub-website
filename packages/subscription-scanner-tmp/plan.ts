/**
 * Extracts the plan or tier name ("Standard", "Premium Family", "Pro").
 *
 * Tried in order, first hit wins:
 *   1. A labelled line:            "Plan: Premium Family"
 *   2. "your/the X plan" phrasing: "You're on the Standard plan"
 *   3. Provider name + tier words: "Spotify Premium Individual"
 */
import { TIER_WORDS } from "./provider";

const MAX_PLAN_LENGTH = 50;
/** Captured "plan names" that are really just filler words. */
const NOT_A_PLAN = new Set([
  "your",
  "the",
  "this",
  "current",
  "new",
  "same",
  "subscription",
  "membership",
  "plan",
]);

/** Escapes a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Removes the provider's own name from the front ("Netflix Premium" → "Premium"). */
function stripProviderPrefix(plan: string, providerName: string): string {
  const prefix = new RegExp(`^${escapeRegExp(providerName)}\\s+`, "i");
  return plan.replace(prefix, "").trim();
}

/** Final checks: not empty, not filler, not just the provider name, not too long. */
function acceptPlan(
  candidate: string | undefined,
  providerName: string,
): string | null {
  if (!candidate) return null;
  const plan = stripProviderPrefix(candidate.trim(), providerName);
  if (plan.length < 2 || plan.length > MAX_PLAN_LENGTH) return null;
  if (NOT_A_PLAN.has(plan.toLowerCase())) return null;
  if (plan.toLowerCase() === providerName.toLowerCase()) return null;
  return plan;
}

/**
 * Reads the value of a "Plan:" style label line, cutting it off before any
 * price, period or bracketed note ("Premium (Monthly) $9.99" → "Premium").
 */
function fromLabelLine(text: string): string | undefined {
  // "Plan: Premium" or, from an HTML table, "Plan | Premium".
  const match =
    /^\s*(?:subscription plan|plan|tier|membership(?: type| plan)?|product)\s*[:|]\s*([^\n]{2,80})$/im.exec(
      text,
    );
  return match?.[1]
    ?.split(/\s{2,}|\s[-–|]\s|\(|[$€£¥₹]|\b(?:USD|EUR|GBP|PKR|INR)\b|\d/)[0]
    ?.trim();
}

/** Finds every "your Premium plan", "the Standard plan", "Your Pro membership". */
function fromPlanPhrases(text: string): string[] {
  const re =
    /\b(?:[Tt]he|[Yy]our|[Aa]n?) ((?:[A-Z][\w+]*|\d+[A-Za-z]*)(?: (?:[A-Z][\w+]*|\d+[A-Za-z]*)){0,3}) (?:plan|tier|membership|subscription)\b/g;
  return [...text.matchAll(re)].map((m) => m[1] ?? "");
}

/**
 * Finds the provider name followed by tier words ("Spotify Premium
 * Individual"). If the email mentions several, the longest (most specific)
 * one wins, so "Spotify Premium" in a subject doesn't hide "Spotify Premium
 * Individual" in the body.
 */
function fromProviderTier(
  text: string,
  providerName: string,
): string | undefined {
  const tiers = TIER_WORDS.join("|");
  const re = new RegExp(
    `\\b${escapeRegExp(providerName)}\\s+((?:${tiers})(?:\\s+(?:${tiers})){0,2})\\b`,
    "gi",
  );
  const longest = [...text.matchAll(re)]
    .map((m) => m[1] ?? "")
    .sort((a, b) => b.length - a.length)[0];
  if (!longest) return undefined;
  // Normalize case so "PREMIUM" and "premium" become "Premium".
  return longest
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Returns the plan name mentioned in the text, or null if none is clear. */
export function extractPlanName(
  text: string,
  providerName: string,
): string | null {
  const fromLabel = acceptPlan(fromLabelLine(text), providerName);
  if (fromLabel) return fromLabel;
  for (const phrase of fromPlanPhrases(text)) {
    const plan = acceptPlan(phrase, providerName);
    if (plan) return plan;
  }
  return acceptPlan(fromProviderTier(text, providerName), providerName);
}

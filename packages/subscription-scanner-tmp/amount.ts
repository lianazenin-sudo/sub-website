/**
 * Finds prices in email text and decides which one is the subscription price.
 *
 * A receipt usually contains several amounts (subtotal, tax, total, maybe a
 * discount). Each amount is scored by the label closest to it ("Total" is
 * good, "Tax" is bad) and by a billing period right after it ("$9.99/month"
 * is the strongest signal). If two *different* amounts tie for the top
 * score, the price is reported as ambiguous instead of guessing.
 */
import { moneyEquals, toMinorUnits } from "../domain/money";
import type { Money } from "../domain/types";

/** Currency tokens as they appear in emails, mapped to ISO codes. null = depends on context. */
const TOKEN_TO_CURRENCY: Readonly<Record<string, string | null>> = {
  US$: "USD",
  CA$: "CAD",
  C$: "CAD",
  AU$: "AUD",
  A$: "AUD",
  NZ$: "NZD",
  HK$: "HKD",
  S$: "SGD",
  R$: "BRL",
  "€": "EUR",
  "£": "GBP",
  "₹": "INR",
  円: "JPY",
  $: null,
  "¥": null,
  "Rs.": null,
  Rs: null,
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  INR: "INR",
  PKR: "PKR",
  CAD: "CAD",
  AUD: "AUD",
  NZD: "NZD",
  CHF: "CHF",
  SGD: "SGD",
  HKD: "HKD",
  AED: "AED",
  SAR: "SAR",
  CNY: "CNY",
  KRW: "KRW",
  BRL: "BRL",
  MXN: "MXN",
  ZAR: "ZAR",
  SEK: "SEK",
  NOK: "NOK",
  DKK: "DKK",
  PLN: "PLN",
  TRY: "TRY",
  LKR: "LKR",
  NPR: "NPR",
  BDT: "BDT",
};

/** Escapes a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest tokens first so "US$" wins over "$" and "Rs." over "Rs".
const TOKEN_ALTERNATION = Object.keys(TOKEN_TO_CURRENCY)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");
// "1,234.56" | "1.234,56" | "9.99" | "1500"
const NUMBER = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
/** Currency before the number: "$9.99", "USD 9.99", "Rs. 1,500". */
const PREFIX_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9])(${TOKEN_ALTERNATION})\s?(${NUMBER})(?!\d)`,
  "g",
);
/** Currency after the number: "9,99 €", "9.99 USD", "1,200円". */
const SUFFIX_RE = new RegExp(
  String.raw`(?<![\d.,])(${NUMBER})\s?(${TOKEN_ALTERNATION})(?![A-Za-z])`,
  "g",
);

/** Labels that may precede an amount, with how much they suggest "this is the price". */
const LABEL_RULES: ReadonlyArray<{ re: RegExp; weight: number }> = [
  {
    re: /\b(?:grand total|order total|total(?: charged| paid| due)?|amount (?:charged|paid|due|billed))\b/gi,
    weight: 3,
  },
  {
    re: /\b(?:you paid|charged|billed|price|cost|fee|payment of|renews? (?:at|for)|(?:increas(?:e|es|ing)|chang(?:e|es|ing)|going up|ris(?:e|es|ing)) to|will be|then)\b/gi,
    weight: 2,
  },
  { re: /\bsubtotal\b/gi, weight: 1 },
  {
    re: /\b(?:tax|vat|gst|discount|savings?|you save|save|credit|refund|was|previously|balance|off)\b/gi,
    weight: -3,
  },
];
/** A billing period right after the amount ("/month", "per year", "a week"). */
const PERIOD_AFTER =
  /^\s*(?:\/|per\b|a\b|an\b|every\b|each\b)\s*(?:mo|mth|month|yr|year|wk|week|quarter|annum)\b/i;
/** "… $5 off" — a discount, not a price. */
const OFF_AFTER = /^\s*off\b/i;

export interface AmountCandidate {
  money: Money;
  /** Position of the whole match (currency + number) in the text. */
  start: number;
  end: number;
  score: number;
}

export interface AmountExtraction {
  price: Money | null;
  previousPrice: Money | null;
  /** End position of the chosen price (used to read "/month" next to it). */
  priceEnd: number | null;
  /** True when two different amounts were equally likely to be the price. */
  ambiguous: boolean;
}

/**
 * Converts a captured number to a plain decimal string ("1.234,56" →
 * "1234.56", "1,500" → "1500", "9,99" → "9.99"). The last separator is the
 * decimal point unless it is followed by exactly three digits and is the
 * only kind of separator, in which case it's a thousands separator.
 */
export function parseDecimal(raw: string): string | null {
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);
  if (lastSep === -1) return /^\d+$/.test(raw) ? raw : null;
  const usesBoth = lastDot !== -1 && lastComma !== -1;
  const separatorCount = (raw.match(/[.,]/g) ?? []).length;
  const after = raw.slice(lastSep + 1);
  const isThousands = !usesBoth && (separatorCount > 1 || after.length === 3);
  if (isThousands) return raw.replace(/[.,]/g, "");
  return `${raw.slice(0, lastSep).replace(/[.,]/g, "")}.${after}`;
}

/**
 * Resolves symbols shared by several currencies by looking for an explicit
 * ISO code elsewhere in the email. "$" falls back to USD (by far the most
 * common), "¥" to JPY unless CNY/RMB appears, and "Rs" stays unresolved
 * unless PKR/INR/LKR/NPR is written somewhere, because guessing would be
 * wrong too often.
 */
export function resolveCurrency(
  token: string,
  fullText: string,
): string | null {
  const mapped = TOKEN_TO_CURRENCY[token];
  if (mapped) return mapped;
  const mentions = (codes: string[]): string | null =>
    codes.find((code) => new RegExp(`\\b${code}\\b`).test(fullText)) ?? null;
  if (token === "$")
    return mentions(["CAD", "AUD", "NZD", "SGD", "HKD", "MXN"]) ?? "USD";
  if (token === "¥") return /\b(?:CNY|RMB)\b|元/.test(fullText) ? "CNY" : "JPY";
  if (token === "Rs" || token === "Rs.")
    return mentions(["PKR", "INR", "LKR", "NPR"]);
  return null;
}

/**
 * Finds every currency amount in the text (both "$9.99" and "9.99 USD"
 * styles). If one number was matched both ways, the explicit ISO-code match
 * wins. Candidates come back unscored and in text order.
 */
export function findAmountCandidates(text: string): AmountCandidate[] {
  const byNumberStart = new Map<
    number,
    AmountCandidate & { explicitCode: boolean }
  >();
  const collect = (
    re: RegExp,
    tokenGroup: number,
    numberGroup: number,
  ): void => {
    for (const match of text.matchAll(re)) {
      const token = match[tokenGroup] ?? "";
      const numberText = match[numberGroup] ?? "";
      const decimal = parseDecimal(numberText);
      const currency = resolveCurrency(token, text);
      if (!decimal || !currency) continue;
      const amountMinor = toMinorUnits(decimal, currency);
      if (amountMinor === null) continue;
      const start = match.index ?? 0;
      const numberStart = start + match[0].indexOf(numberText);
      const candidate = {
        money: { amountMinor, currency },
        start,
        end: start + match[0].length,
        score: 0,
        explicitCode: /^[A-Z]{3}$/.test(token),
      };
      const existing = byNumberStart.get(numberStart);
      if (!existing || (!existing.explicitCode && candidate.explicitCode))
        byNumberStart.set(numberStart, candidate);
    }
  };
  collect(PREFIX_RE, 1, 2);
  collect(SUFFIX_RE, 2, 1);
  return [...byNumberStart.values()]
    .sort((a, b) => a.start - b.start)
    .map(({ explicitCode: _explicitCode, ...candidate }) => candidate);
}

/** True when the text contains at least one currency amount. */
export function containsMoney(text: string): boolean {
  return findAmountCandidates(text).length > 0;
}

/**
 * Scores one amount by its surroundings: the weight of the closest label in
 * the 50 characters before it, +3 for a billing period right after it, −3
 * for "off" right after it.
 */
export function scoreCandidate(
  text: string,
  candidate: AmountCandidate,
): number {
  const before = text.slice(Math.max(0, candidate.start - 50), candidate.start);
  const after = text.slice(candidate.end, candidate.end + 25);
  let closest: { end: number; weight: number } | null = null;
  for (const rule of LABEL_RULES) {
    for (const match of before.matchAll(rule.re)) {
      const end = (match.index ?? 0) + match[0].length;
      if (!closest || end >= closest.end)
        closest = { end, weight: rule.weight };
    }
  }
  let score = closest?.weight ?? 0;
  if (PERIOD_AFTER.test(after)) score += 3;
  if (OFF_AFTER.test(after)) score -= 3;
  return score;
}

/**
 * Detects "from $15.49 to $17.99" (price-change notices) between two
 * consecutive amounts. Returns the old and new amounts, or null.
 */
function findPriceChange(
  text: string,
  candidates: AmountCandidate[],
): { previous: AmountCandidate; current: AmountCandidate } | null {
  for (let i = 0; i + 1 < candidates.length; i += 1) {
    const previous = candidates[i];
    const current = candidates[i + 1];
    if (!previous || !current) continue;
    const between = text.slice(previous.end, current.start);
    const lead = text.slice(Math.max(0, previous.start - 12), previous.start);
    if (/^\s*(?:to|->|→)\s*$/i.test(between) && /\bfrom\s*$/i.test(lead))
      return { previous, current };
  }
  return null;
}

/**
 * Extracts the subscription price (and the old price, for price changes).
 * Returns ambiguous=true with no price when two different amounts tie,
 * e.g. "$9.99/month or $99.99/year".
 */
export function extractAmounts(text: string): AmountExtraction {
  const candidates = findAmountCandidates(text);
  if (candidates.length === 0)
    return {
      price: null,
      previousPrice: null,
      priceEnd: null,
      ambiguous: false,
    };

  const change = findPriceChange(text, candidates);
  if (change) {
    return {
      price: change.current.money,
      previousPrice: change.previous.money,
      priceEnd: change.current.end,
      ambiguous: false,
    };
  }

  const scored = candidates
    .map((c) => ({ ...c, score: scoreCandidate(text, c) }))
    .sort((a, b) => b.score - a.score || a.start - b.start);
  const best = scored[0];
  if (!best || best.score < 0)
    return {
      price: null,
      previousPrice: null,
      priceEnd: null,
      ambiguous: false,
    };

  const rival = scored.find(
    (c) => c.score === best.score && !moneyEquals(c.money, best.money),
  );
  if (rival)
    return {
      price: null,
      previousPrice: null,
      priceEnd: null,
      ambiguous: true,
    };
  return {
    price: best.money,
    previousPrice: null,
    priceEnd: best.end,
    ambiguous: false,
  };
}

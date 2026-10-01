/**
 * Money helpers: convert human-readable decimals into integer minor units
 * and compare Money values without floating-point maths.
 *
 * Prices in this engine are always `{ amountMinor, currency }`. A bare
 * decimal like "9.99" is only an intermediate form while parsing email text;
 * it is never stored.
 */
import type { Money } from "./types";

/**
 * ISO 4217 currencies whose minor unit is the major unit itself (no cents).
 * Anything not listed here or in THREE_DECIMAL_CURRENCIES is treated as
 * two-decimal (the common case: USD, EUR, GBP, PKR…).
 */
const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/** ISO 4217 currencies with three decimal places (fils / baisa). */
const THREE_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);

/**
 * Returns how many decimal places a currency uses in its minor unit
 * (0 for JPY, 3 for KWD, 2 for everything else we care about).
 */
export function minorUnitExponent(currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

/**
 * Converts a plain decimal string ("9.99", "1500", "1234.56") into an
 * integer minor-unit amount for the given ISO currency. Returns null when
 * the string is not a finite non-negative number, or when it has more
 * fraction digits than the currency allows (so we never round silently).
 */
export function toMinorUnits(
  decimal: string,
  currency: string,
): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(decimal)) return null;
  const [wholePart = "0", fractionPart = ""] = decimal.split(".");
  const exponent = minorUnitExponent(currency);
  if (fractionPart.length > exponent) return null;

  const paddedFraction = fractionPart.padEnd(exponent, "0");
  const digits = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(digits)) return null;

  const minor = Number(digits);
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  return minor;
}

/**
 * True when two Money values represent the same amount in the same currency.
 * Comparing the integer minor units avoids float equality traps.
 */
export function moneyEquals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

/**
 * Finds dates in email text and works out what each one means.
 *
 * Step 1 parses every date-looking string (ISO, "October 15, 2026",
 * "15 Oct 2026", "10/15/2026", "2026年10月15日", "in 3 days", "tomorrow").
 * Step 2 gives each date a role from the closest label before it ("renews
 * on" → renewal date, "until" → expiration date). Dates with no label are
 * ignored: an unlabeled date is not something we can use reliably.
 *
 * Numeric dates like 03/04/2026 can be March 4 or April 3. When both are
 * valid we don't pick one; the role is reported as ambiguous.
 */
import {
  addDays,
  daysBetween,
  makeDateOnly,
  toDateOnly,
} from "../domain/date-only";
import type { DateOnly } from "../domain/types";

export type DateRole =
  | "trialEndDate"
  | "cancellationDate"
  | "renewalDate"
  | "expirationDate"
  | "startDate"
  | "paymentDate";

interface ParsedDate {
  start: number;
  end: number;
  /** The date, or null when it has several valid readings. */
  value: DateOnly | null;
  /** All valid readings (two for an ambiguous numeric date). */
  readings: DateOnly[];
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?`;

const ISO_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
const JAPANESE_RE = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
const MONTH_FIRST_RE = new RegExp(
  String.raw`\b${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4})\b)?`,
  "gi",
);
const DAY_FIRST_RE = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}(?:,?\s+(\d{4})\b)?`,
  "gi",
);
const NUMERIC_RE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g;
const RELATIVE_RE =
  /\b(?:in|within)\s+(\d{1,3}|one|two|three|four|five|six|seven|ten|fourteen|thirty)\s+(days?|weeks?)\b|\b(tomorrow|today)\b/gi;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  ten: 10,
  fourteen: 14,
  thirty: 30,
};

/**
 * Role labels. When several labels sit before a date, the closest one wins;
 * on an exact tie, the earlier entry in this list wins (more specific first).
 */
const ROLE_RULES: ReadonlyArray<{ role: DateRole; re: RegExp }> = [
  {
    role: "trialEndDate",
    re: /\b(?:trial (?:period )?(?:ends?|ending|expires?|will end|is over|until|through)(?: on)?|end of (?:your |the )?(?:free )?trial|after (?:your|the) (?:free )?trial|free (?:until|through))\b/gi,
  },
  {
    role: "cancellationDate",
    re: /\b(?:cancell?ed (?:on|as of)|cancell?ation (?:date|effective|on)|date (?:of )?cancell?(?:ed|ation))\b/gi,
  },
  {
    role: "renewalDate",
    re: /\b(?:renew(?:s|al)?(?: date)?(?: on)?|next (?:billing|payment|charge|bill|invoice|renewal)(?: date)?(?: is| on)?|(?:will|you'll) be (?:charged|billed)(?: on)?|billing date(?: on)?|due (?:on|date))\b/gi,
  },
  {
    role: "expirationDate",
    re: /\b(?:expir(?:es|ed|y|ation)(?: date)?(?: on)?|access (?:until|through|ends(?: on)?)|valid (?:until|through)|until|ends on|end date)\b/gi,
  },
  {
    role: "startDate",
    re: /\b(?:start(?:s|ed)?(?: date)?(?: on)?|member since|subscribed on|activated on|effective (?:from|date|on)|begins? on|subscription date)\b/gi,
  },
  {
    role: "paymentDate",
    re: /\b(?:(?:payment|charge|order|invoice|purchase|transaction|receipt) date|(?:paid|charged|processed|billed) on|date (?:paid|of (?:payment|purchase))|date)\b/gi,
  },
];

/** How far before a date we look for its label. */
const LABEL_WINDOW = 70;

/** Converts a month token ("Sept.", "october") to 1–12, or null. */
function monthNumber(token: string): number | null {
  return MONTHS[token.toLowerCase().replace(/\.$/, "").slice(0, 3)] ?? null;
}

/**
 * For a date written without a year ("Oct 5"), picks the year (last, this or
 * next) that puts it closest to when the email was received.
 */
function inferYear(
  month: number,
  day: number,
  reference: DateOnly,
): DateOnly | null {
  const year = Number(reference.slice(0, 4));
  const options = [year - 1, year, year + 1]
    .map((y) => makeDateOnly(y, month, day))
    .filter((d): d is DateOnly => d !== null)
    .sort((a, b) => daysBetween(a, reference) - daysBetween(b, reference));
  return options[0] ?? null;
}

/** Builds a date from parts, inferring the year when it's missing. */
function fromParts(
  year: string | undefined,
  month: number | null,
  day: number,
  reference: DateOnly,
): DateOnly | null {
  if (month === null) return null;
  return year
    ? makeDateOnly(Number(year), month, day)
    : inferYear(month, day, reference);
}

/**
 * Reads a numeric date. If the first number is > 12 it's day-first; if the
 * second is > 12 it's month-first; otherwise both readings may be valid.
 */
function numericReadings(a: number, b: number, yearText: string): DateOnly[] {
  const year =
    yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  const monthFirst = makeDateOnly(year, a, b);
  const dayFirst = makeDateOnly(year, b, a);
  return [
    ...new Set([monthFirst, dayFirst].filter((d): d is DateOnly => d !== null)),
  ];
}

/** Keeps dates within a sensible window around the email (−15 to +5 years). */
function isPlausible(date: DateOnly, reference: DateOnly): boolean {
  const offsetYears =
    (Date.parse(date) - Date.parse(reference)) / (365.25 * 86_400_000);
  return offsetYears >= -15 && offsetYears <= 5;
}

/**
 * Finds every date in the text, in text order, with overlapping matches
 * removed (the longer match wins, e.g. a full "15 October 2026").
 */
export function findDates(text: string, receivedAt: Date): ParsedDate[] {
  const reference = toDateOnly(receivedAt);
  const found: ParsedDate[] = [];
  const add = (
    match: RegExpMatchArray,
    readings: Array<DateOnly | null>,
  ): void => {
    const valid = [
      ...new Set(
        readings.filter(
          (d): d is DateOnly => d !== null && isPlausible(d, reference),
        ),
      ),
    ];
    if (valid.length === 0) return;
    const start = match.index ?? 0;
    found.push({
      start,
      end: start + match[0].length,
      value: valid.length === 1 ? (valid[0] ?? null) : null,
      readings: valid,
    });
  };

  for (const m of text.matchAll(ISO_RE))
    add(m, [makeDateOnly(Number(m[1]), Number(m[2]), Number(m[3]))]);
  for (const m of text.matchAll(JAPANESE_RE))
    add(m, [makeDateOnly(Number(m[1]), Number(m[2]), Number(m[3]))]);
  for (const m of text.matchAll(MONTH_FIRST_RE))
    add(m, [fromParts(m[3], monthNumber(m[1] ?? ""), Number(m[2]), reference)]);
  for (const m of text.matchAll(DAY_FIRST_RE))
    add(m, [fromParts(m[3], monthNumber(m[2] ?? ""), Number(m[1]), reference)]);
  for (const m of text.matchAll(NUMERIC_RE))
    add(m, numericReadings(Number(m[1]), Number(m[2]), m[3] ?? ""));
  for (const m of text.matchAll(RELATIVE_RE)) {
    if (m[3]) {
      add(m, [
        m[3].toLowerCase() === "tomorrow" ? addDays(reference, 1) : reference,
      ]);
    } else {
      const amount = NUMBER_WORDS[(m[1] ?? "").toLowerCase()] ?? Number(m[1]);
      const days = (m[2] ?? "").toLowerCase().startsWith("week")
        ? amount * 7
        : amount;
      add(m, [Number.isFinite(days) ? addDays(reference, days) : null]);
    }
  }

  found.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );
  const result: ParsedDate[] = [];
  let lastEnd = -1;
  for (const date of found) {
    if (date.start >= lastEnd) {
      result.push(date);
      lastEnd = date.end;
    }
  }
  return result;
}

/**
 * Returns the role of the label closest before `start` (within the window),
 * or null if no label is near. Ties go to the more specific role.
 */
function roleFor(text: string, start: number): DateRole | null {
  const before = text.slice(Math.max(0, start - LABEL_WINDOW), start);
  let best: { role: DateRole; end: number; rank: number } | null = null;
  for (const [rank, rule] of ROLE_RULES.entries()) {
    for (const match of before.matchAll(rule.re)) {
      const end = (match.index ?? 0) + match[0].length;
      if (!best || end > best.end || (end === best.end && rank < best.rank))
        best = { role: rule.role, end, rank };
    }
  }
  if (!best) return null;
  // The label must sit right before the date: only punctuation, a linking
  // word ("on", "is") and/or a weekday ("Monday,") may come in between.
  return LABEL_GAP.test(before.slice(best.end)) ? best.role : null;
}

/** What may separate a label from its date: "Renews: Monday, Oct 5", "ends on Oct 5", "Renewal date | Oct 5". */
const LABEL_GAP =
  /^[\s:,|(-]*(?:(?:is|on|of|at|by|for|from)\b[\s:,|(-]*)?(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day\b[\s:,|(-]*)?$/i;

export interface DateExtraction {
  dates: Partial<Record<DateRole, DateOnly>>;
  /** Roles that had a date we couldn't read unambiguously or that conflicted. */
  ambiguousRoles: DateRole[];
}

/**
 * Finds the dates in an email and assigns them roles. If one role receives
 * two different dates, or only an ambiguous one, it's reported as ambiguous
 * and left empty.
 */
export function extractDates(text: string, receivedAt: Date): DateExtraction {
  const byRole = new Map<DateRole, ParsedDate[]>();
  for (const date of findDates(text, receivedAt)) {
    const role = roleFor(text, date.start);
    if (role) byRole.set(role, [...(byRole.get(role) ?? []), date]);
  }

  const dates: Partial<Record<DateRole, DateOnly>> = {};
  const ambiguousRoles: DateRole[] = [];
  for (const [role, entries] of byRole) {
    const definite = [
      ...new Set(
        entries.map((e) => e.value).filter((v): v is DateOnly => v !== null),
      ),
    ];
    const unclear = entries.filter((e) => e.value === null);
    // An ambiguous reading is fine if a definite date for the same role is one of its readings.
    const unclearResolved = unclear.every(
      (e) => definite.length === 1 && e.readings.includes(definite[0] ?? ""),
    );
    if (definite.length === 1 && unclearResolved) {
      dates[role] = definite[0];
    } else {
      ambiguousRoles.push(role);
    }
  }
  return { dates, ambiguousRoles };
}

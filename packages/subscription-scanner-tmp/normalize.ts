/**
 * Turns a validated RawEmail into the NormalizedEmail every later stage uses:
 * parsed sender, plain-text body, canonical characters, and identity keys.
 */
import type { NormalizedEmail } from "../domain/types";
import {
  contentFingerprint,
  emailIdFor,
  normalizeMessageIdHeader,
} from "../dedup/identity";
import type { RawEmail } from "./email-source";
import { htmlToText, tidyWhitespace } from "./html-to-text";

/** Upper bound on HTML processed per email, to keep work per email bounded. */
const MAX_HTML_CHARS = 1_000_000;
/** Upper bound on plain text analysed per email. Receipts are far shorter. */
const MAX_TEXT_CHARS = 100_000;
/** A text/plain part shorter than this is usually "view in browser" filler. */
const MIN_USEFUL_TEXT_CHARS = 40;

export interface ParsedSender {
  name: string | null;
  address: string;
  domain: string;
}

/**
 * Parses a From header (`"Netflix" <info@account.netflix.com>` or a bare
 * address) into display name, lowercase address and lowercase domain.
 * Returns null if no usable address is present.
 */
export function parseFromHeader(from: string): ParsedSender | null {
  let address: string;
  let name: string | null = null;
  const angle = /<\s*([^<>\s]+@[^<>\s]+)\s*>/.exec(from);
  if (angle?.[1]) {
    address = angle[1];
    const display = from
      .slice(0, angle.index)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .trim();
    name = display.length > 0 ? display : null;
  } else {
    const bare = /([^\s<>"']+@[^\s<>"']+)/.exec(from);
    if (!bare?.[1]) return null;
    address = bare[1];
  }
  address = address.toLowerCase().replace(/^mailto:/, "");
  const domain = address.slice(address.lastIndexOf("@") + 1).replace(/\.$/, "");
  if (!domain.includes(".")) return null;
  return { name, address, domain };
}

/**
 * Canonicalizes characters so rules only need one spelling: Unicode NFKC
 * (full-width digits → ASCII, ligatures split, "₨" → "Rs") and curly quotes
 * → straight quotes ("you’ve" → "you've").
 */
export function canonicalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02bc\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"');
}

/**
 * Picks the body to analyse: the text/plain part when it has real content,
 * otherwise the HTML part converted to text.
 */
function chooseBodyText(raw: RawEmail): string {
  const plain = raw.textBody?.trim() ?? "";
  if (plain.length >= MIN_USEFUL_TEXT_CHARS || !raw.htmlBody)
    return tidyWhitespace(plain);
  return htmlToText(raw.htmlBody.slice(0, MAX_HTML_CHARS));
}

/**
 * Produces the NormalizedEmail for one message of one connected account.
 * Also computes the identity keys used for deduplication.
 */
export function normalizeEmail(
  raw: RawEmail,
  context: { accountId: string; provider: string },
): NormalizedEmail {
  const sender = parseFromHeader(raw.from) ?? {
    name: null,
    address: raw.from.trim().toLowerCase() || "unknown",
    domain: "unknown",
  };
  const subject = canonicalizeText(tidyWhitespace(raw.subject)).slice(0, 500);
  const text = canonicalizeText(chooseBodyText(raw).slice(0, MAX_TEXT_CHARS));
  return {
    id: emailIdFor(context.accountId, context.provider, raw.providerMessageId),
    accountId: context.accountId,
    provider: context.provider,
    providerMessageId: raw.providerMessageId,
    internetMessageId: normalizeMessageIdHeader(raw.internetMessageId),
    fingerprint: contentFingerprint(
      sender.address,
      subject,
      raw.sentAt ?? raw.receivedAt,
      text,
    ),
    receivedAt: raw.receivedAt,
    from: sender,
    subject,
    text,
    labels: raw.labels.map((label) => label.toUpperCase()),
  };
}

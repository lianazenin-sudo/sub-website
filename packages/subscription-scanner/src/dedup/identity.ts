/**
 * Identity and deduplication keys.
 *
 * Every id in the engine is *derived* from its inputs instead of generated
 * randomly. Processing the same email twice therefore produces the same email
 * id, the same event id and the same audit id, and the database's primary
 * keys turn the second attempt into a no-op. That is the core of idempotency.
 *
 * An email is recognised as already seen by any of three keys:
 *   1. provider message id  → same message, same mailbox (primary key)
 *   2. Message-ID header    → same email under a different provider id
 *   3. content fingerprint  → same email when there is no Message-ID header
 */
import { createHash } from "node:crypto";

/** SHA-256 hex digest of a string. */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Builds a short, prefixed id from its parts ("em_3f9a…"). The same parts
 * always yield the same id. Parts are joined with a separator that can't
 * appear in normal text, so ("ab","c") and ("a","bc") don't collide.
 */
export function deterministicId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${sha256(parts.join("\u001f")).slice(0, 32)}`;
}

/** Internal id of an email: account + provider + the provider's message id. */
export function emailIdFor(
  accountId: string,
  provider: string,
  providerMessageId: string,
): string {
  return deterministicId("em", accountId, provider, providerMessageId);
}

/** Id of the (single) event an email produces. */
export function eventIdFor(emailId: string): string {
  return deterministicId("ev", emailId);
}

/** Id of a subscription, derived from the event that created it. */
export function subscriptionIdFor(
  accountId: string,
  creatingEventId: string,
): string {
  return deterministicId("sub", accountId, creatingEventId);
}

/** Id of the audit entry recording what an event did to a subscription. */
export function auditIdFor(eventId: string): string {
  return deterministicId("aud", eventId);
}

/**
 * Id of a review item. Keyed on the email/event and the reason, so a rebuild
 * re-creates the same item instead of reopening one a person already resolved.
 */
export function reviewItemIdFor(sourceId: string, reason: string): string {
  return deterministicId("rev", sourceId, reason);
}

/**
 * Normalizes a Message-ID header ("<CAB12@mail.example.com>") to a bare,
 * lowercase value, or null if it's missing or clearly not a Message-ID.
 */
export function normalizeMessageIdHeader(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^<|>$/g, "").trim().toLowerCase();
  return /^[^\s<>]{3,}@[^\s<>]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Content fingerprint: sender, subject, the minute the email was sent and a
 * hash of the body text. Two copies of one email share it; two different
 * emails (even two identical monthly receipts) differ by at least the date.
 */
export function contentFingerprint(
  fromAddress: string,
  subject: string,
  sentAt: Date,
  text: string,
): string {
  const minute = sentAt.toISOString().slice(0, 16);
  return sha256(
    [fromAddress.toLowerCase(), subject, minute, sha256(text)].join("\u001f"),
  );
}

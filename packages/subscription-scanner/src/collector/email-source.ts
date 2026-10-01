/**
 * The boundary between the email provider and the subscription engine.
 *
 * Everything provider-specific (Gmail API, Microsoft Graph, IMAP, OAuth
 * tokens) lives behind `EmailSource`. The analysis logic never sees provider
 * objects, only `RawEmail`, which is validated with Zod because it comes from
 * an external system.
 *
 * No real provider adapter is implemented yet. A Gmail adapter would map:
 *   getCheckpoint      → users.getProfile().historyId
 *   listMessages       → users.messages.list (q: "after:<since>", pageToken)
 *   listChangesSince   → users.history.list (startHistoryId); a 404 means "expired"
 *   getMessage         → users.messages.get (format: "full"), MIME parts decoded
 */
import { z } from "zod";

export const RawEmailSchema = z.object({
  /** The provider's id for the message (Gmail message id, Graph id…). */
  providerMessageId: z.string().min(1).max(512),
  /** The Message-ID header, if present. */
  internetMessageId: z.string().max(998).nullish(),
  /** When the mailbox received it. */
  receivedAt: z.coerce.date(),
  /** The Date header, if present (more stable than receivedAt across re-imports). */
  sentAt: z.coerce.date().nullish(),
  /** Raw From header, e.g. `"Netflix" <info@account.netflix.com>`. */
  from: z.string().max(2000),
  subject: z.string().max(10_000).default(""),
  textBody: z.string().nullish(),
  htmlBody: z.string().nullish(),
  /** Provider labels/categories (optional hints, never decisive on their own). */
  labels: z.array(z.string().max(200)).max(200).default([]),
});

/** A validated message as returned by an EmailSource. */
export type RawEmail = z.infer<typeof RawEmailSchema>;

/** Input shape before validation (dates may still be strings). */
export type RawEmailInput = z.input<typeof RawEmailSchema>;

export interface MessagePage {
  messageIds: string[];
  /** Opaque token for the next page, or null when there are no more pages. */
  nextPageToken: string | null;
}

export type ChangeSet =
  | { status: "ok"; messageIds: string[]; checkpoint: string }
  /** The provider no longer has history back to the given checkpoint. */
  | { status: "expired" };

export interface EmailSource {
  /** Stable provider name stored with each email ("gmail", "outlook", "memory"). */
  readonly provider: string;

  /** Returns an opaque token for "now" in the mailbox's change stream. */
  getCheckpoint(): Promise<string>;

  /** Lists ids of messages received on/after `since`, one page at a time. */
  listMessages(params: {
    since: Date;
    pageToken: string | null;
    pageSize: number;
  }): Promise<MessagePage>;

  /** Lists ids of messages added after `checkpoint`, plus the new checkpoint. */
  listChangesSince(checkpoint: string): Promise<ChangeSet>;

  /**
   * Fetches one message. Returns `unknown` on purpose: the collector validates
   * it with RawEmailSchema. Returns null if the message no longer exists.
   */
  getMessage(providerMessageId: string): Promise<unknown>;
}

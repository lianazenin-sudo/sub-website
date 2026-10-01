/**
 * A fake mailbox that implements EmailSource entirely in memory.
 *
 * Used by tests and for local development with mock data. It behaves like a
 * real provider in the ways that matter to the engine: paginated listing,
 * a change stream with checkpoints, and change history that can expire.
 */
import {
  RawEmailSchema,
  type ChangeSet,
  type EmailSource,
  type MessagePage,
  type RawEmailInput,
} from "./email-source";

interface StoredMessage {
  /** Delivery order; doubles as the change-stream position. */
  seq: number;
  id: string;
  receivedAt: Date;
  /** Kept exactly as delivered so getMessage() exercises real validation. */
  raw: RawEmailInput;
}

export class InMemoryEmailSource implements EmailSource {
  readonly provider: string;
  private messages: StoredMessage[] = [];
  private seq = 0;
  /** Checkpoints older than this are treated as expired. */
  private historyFloor = 0;

  /** Creates an empty mailbox. `provider` is the name stored with each email. */
  constructor(provider = "memory") {
    this.provider = provider;
  }

  /** Adds a message to the mailbox, as if it had just been delivered. */
  deliver(raw: RawEmailInput): void {
    const parsed = RawEmailSchema.parse(raw);
    if (this.messages.some((m) => m.id === parsed.providerMessageId)) {
      throw new Error(`Message ${parsed.providerMessageId} already delivered`);
    }
    this.seq += 1;
    this.messages.push({
      seq: this.seq,
      id: parsed.providerMessageId,
      receivedAt: parsed.receivedAt,
      raw,
    });
  }

  /** Removes a message, simulating the user deleting it from their inbox. */
  remove(providerMessageId: string): void {
    this.messages = this.messages.filter((m) => m.id !== providerMessageId);
  }

  /**
   * Simulates the provider discarding its change history (Gmail keeps it for
   * roughly a week). The next incremental sync gets `expired` and must rescan.
   */
  expireHistory(): void {
    this.historyFloor = this.seq;
  }

  /** Current position in the change stream. */
  async getCheckpoint(): Promise<string> {
    return String(this.seq);
  }

  /** Lists messages received since `since`, newest first, like Gmail does. */
  async listMessages(params: {
    since: Date;
    pageToken: string | null;
    pageSize: number;
  }): Promise<MessagePage> {
    const sorted = this.messages
      .filter((m) => m.receivedAt.getTime() >= params.since.getTime())
      .sort(
        (a, b) =>
          b.receivedAt.getTime() - a.receivedAt.getTime() || b.seq - a.seq,
      );
    const offset = params.pageToken ? Number(params.pageToken) : 0;
    const page = sorted.slice(offset, offset + params.pageSize);
    const nextOffset = offset + params.pageSize;
    return {
      messageIds: page.map((m) => m.id),
      nextPageToken: nextOffset < sorted.length ? String(nextOffset) : null,
    };
  }

  /** Lists messages delivered after `checkpoint`, or `expired` if history was discarded. */
  async listChangesSince(checkpoint: string): Promise<ChangeSet> {
    const position = Number(checkpoint);
    if (!Number.isInteger(position) || position < this.historyFloor)
      return { status: "expired" };
    return {
      status: "ok",
      messageIds: this.messages
        .filter((m) => m.seq > position)
        .map((m) => m.id),
      checkpoint: String(this.seq),
    };
  }

  /** Returns a copy of the stored message, or null if it was removed. */
  async getMessage(providerMessageId: string): Promise<unknown> {
    const found = this.messages.find((m) => m.id === providerMessageId);
    return found ? structuredClone(found.raw) : null;
  }
}

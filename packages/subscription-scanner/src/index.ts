/**
 * Public API of the Trace subscription engine (server-side only).
 *
 * Typical use from a worker or API route:
 *
 *   const repo = PostgresRepository.fromConnectionString(process.env.DATABASE_URL!);
 *   const source = createGmailSource(account);   // provider adapter (not part of this package yet)
 *   const report = await syncAccount({ repo, source, accountId: account.id });
 */
export { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config";
export * from "./domain/types";
export type {
  EmailSource,
  RawEmail,
  RawEmailInput,
  ChangeSet,
  MessagePage,
} from "./collector/email-source";
export { RawEmailSchema } from "./collector/email-source";
export { InMemoryEmailSource } from "./collector/in-memory-email-source";
export { normalizeEmail } from "./collector/normalize";
export { classifyEmail } from "./classifier/classifier";
export { extractSubscriptionData } from "./extractor/extractor";
export { matchSubscription } from "./matcher/matcher";
export { projectSubscription } from "./state/project";
export type { Repository, RepositoryTx } from "./persistence/repository";
export { InMemoryRepository } from "./persistence/in-memory-repository";
export { PostgresRepository } from "./persistence/postgres-repository";
export { analyzeEmail } from "./pipeline/analyze";
export {
  processMessage,
  type EngineContext,
  type ProcessOutcome,
} from "./pipeline/process-email";
export { syncAccount, type SyncReport } from "./pipeline/sync";
export {
  rebuildAccountSubscriptions,
  type RebuildReport,
} from "./pipeline/rebuild";

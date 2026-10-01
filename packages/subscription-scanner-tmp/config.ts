/**
 * Engine configuration.
 *
 * Every tunable number lives here so behaviour can be adjusted without
 * touching the logic. `rulesVersion` is stamped on every processed email, so
 * when the classification/extraction rules change you can find the emails
 * that were analysed by older rules and reprocess them.
 */
export interface EngineConfig {
  /** Bump whenever classifier or extractor rules change. */
  rulesVersion: string;
  /** How far back the first scan of a newly connected inbox reaches. */
  initialScanMonths: number;
  /** Message ids requested per page while scanning. */
  pageSize: number;
  /** A failing email is retried this many times, then left for inspection. */
  maxAttempts: number;
  /** How many previously failed emails are retried per sync run. */
  retryBatchSize: number;
  classification: {
    /** Final score below this → the email is unrelated and ignored. */
    ignoreBelow: number;
    /** Final score at or above this → processed automatically. In between → review queue. */
    acceptAt: number;
    /**
     * If a conflicting event type scores within this many points of the
     * winner, the email's meaning is ambiguous and it won't change status.
     */
    ambiguityMargin: number;
  };
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  rulesVersion: '2026-10-01.1',
  initialScanMonths: 24,
  pageSize: 100,
  maxAttempts: 3,
  retryBatchSize: 50,
  classification: {
    ignoreBelow: 3,
    acceptAt: 6,
    ambiguityMargin: 1,
  },
};
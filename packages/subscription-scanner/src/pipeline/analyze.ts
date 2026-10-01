/**
 * Pure analysis of one email: Classifier → Extractor.
 *
 * No I/O, no database, no network. Kept separate from processing so it can
 * be unit-tested, run as a "dry run" on sample emails, and executed outside
 * the database transaction (so slow parsing never holds a lock).
 */
import { classifyEmail } from "../classifier/classifier";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import type { EmailAnalysis, NormalizedEmail } from "../domain/types";
import { extractSubscriptionData } from "../extractor/extractor";

/**
 * Classifies the email and, unless it is ignored, extracts its subscription
 * data. Emails sent to review still get extracted data, so a reviewer can
 * see what the engine thought.
 */
export function analyzeEmail(
  email: NormalizedEmail,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): EmailAnalysis {
  const classification = classifyEmail(email, config.classification);
  if (
    classification.decision === "ignore" ||
    classification.eventType === null
  ) {
    return { classification, extracted: null, reviewReasons: [] };
  }
  const { data, reviewReasons } = extractSubscriptionData(
    email,
    classification.eventType,
  );
  return { classification, extracted: data, reviewReasons };
}

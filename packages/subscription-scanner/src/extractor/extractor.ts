/**
 * Data Extractor stage: turns one subscription email into structured fields.
 *
 * Missing fields are simply null; only fields that are present but unclear
 * (two possible prices, a date with two readings, an unknown merchant behind
 * a payment platform) produce review reasons.
 */
import { toDateOnly } from "../domain/date-only";
import {
  ExtractedSubscriptionDataSchema,
  type ExtractedSubscriptionData,
  type NormalizedEmail,
  type ReviewReason,
  type SubscriptionEventType,
} from "../domain/types";
import { extractAmounts } from "./amounts";
import { extractDates } from "./dates";
import { extractBillingFrequency } from "./frequency";
import { extractPlanName } from "./plan";
import { resolveProvider } from "./provider";

export interface ExtractionResult {
  data: ExtractedSubscriptionData;
  reviewReasons: ReviewReason[];
}

/**
 * Extracts provider, plan, price, billing frequency and dates from an email
 * already classified as `eventType`. The result is validated with Zod as a
 * final guard, since every field was derived from untrusted text.
 */
export function extractSubscriptionData(
  email: NormalizedEmail,
  eventType: SubscriptionEventType,
): ExtractionResult {
  const text = `${email.subject}\n${email.text}`;
  const reviewReasons: ReviewReason[] = [];

  const provider = resolveProvider(email);
  if (provider.unresolvedMerchant) reviewReasons.push("unresolved_merchant");

  const amounts = extractAmounts(text);
  if (amounts.ambiguous) reviewReasons.push("ambiguous_price");

  const { dates, ambiguousRoles } = extractDates(text, email.receivedAt);
  if (ambiguousRoles.length > 0) reviewReasons.push("ambiguous_date");

  const isTrialEvent =
    eventType === "trial_started" || eventType === "trial_ending";
  const mentionsFreeTrial = /\bfree trial\b/i.test(text);

  // A cancellation that names the date it "would have renewed" is the date access ends.
  const expirationDate =
    dates.expirationDate ??
    (eventType === "cancelled" ? (dates.renewalDate ?? null) : null);
  const renewalDate =
    eventType === "cancelled" ? null : (dates.renewalDate ?? null);

  const candidate: ExtractedSubscriptionData = {
    providerKey: provider.providerKey,
    providerName: provider.providerName,
    billedVia: provider.billedVia,
    planName: provider.planHint ?? extractPlanName(text, provider.providerName),
    price: amounts.price,
    previousPrice: amounts.previousPrice,
    billingFrequency: extractBillingFrequency(text, amounts.priceEnd),
    startDate: dates.startDate ?? null,
    renewalDate,
    expirationDate,
    cancellationDate: dates.cancellationDate ?? null,
    trialEndDate: dates.trialEndDate ?? null,
    // A payment receipt with no explicit date was paid on the day it arrived.
    paymentDate:
      dates.paymentDate ??
      (eventType === "payment_succeeded" ? toDateOnly(email.receivedAt) : null),
    isTrial:
      isTrialEvent ||
      (mentionsFreeTrial &&
        dates.trialEndDate !== undefined &&
        eventType !== "payment_succeeded"),
  };

  const parsed = ExtractedSubscriptionDataSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Extracted data failed validation: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return { data: parsed.data, reviewReasons };
}

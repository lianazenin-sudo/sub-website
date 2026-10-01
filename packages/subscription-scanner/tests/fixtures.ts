/**
 * Test fixtures: a small but realistic inbox mixing subscription emails with
 * the kinds of mail the engine must ignore.
 */
import type { RawEmailInput } from "../src/collector/email-source";
import { normalizeEmail } from "../src/collector/normalize";
import { RawEmailSchema } from "../src/collector/email-source";
import type { NormalizedEmail } from "../src/domain/types";

/** Builds a raw email with sensible defaults. */
export function mail(p: {
  id: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  at: string;
  messageId?: string;
  labels?: string[];
}): RawEmailInput {
  return {
    providerMessageId: p.id,
    internetMessageId: p.messageId ?? `<${p.id}@mail.test>`,
    receivedAt: p.at,
    from: p.from,
    subject: p.subject,
    textBody: p.text ?? null,
    htmlBody: p.html ?? null,
    labels: p.labels ?? [],
  };
}

/** Normalizes a raw fixture directly (for unit tests of classifier/extractor). */
export function normalized(
  raw: RawEmailInput,
  accountId = "acc_test",
): NormalizedEmail {
  return normalizeEmail(RawEmailSchema.parse(raw), {
    accountId,
    provider: "memory",
  });
}

const NETFLIX = "Netflix <info@account.netflix.com>";
const SPOTIFY = "Spotify <no-reply@spotify.com>";

export const netflixWelcome = mail({
  id: "m-netflix-welcome",
  from: NETFLIX,
  subject: "Welcome to Netflix! Your membership has started",
  text: [
    "Hi Nana,",
    "Your Netflix membership has started. You're on the Standard plan for USD 15.49/month.",
    "Your next billing date is April 1, 2026.",
  ].join("\n"),
  at: "2026-03-01T10:00:00Z",
});

export const netflixReceipt = mail({
  id: "m-netflix-receipt-apr",
  from: NETFLIX,
  subject: "Your Netflix receipt",
  html: `<html><head><style>td{padding:4px}</style></head><body>
    <p>Thanks for your payment. Your membership has been renewed.</p>
    <table>
      <tr><td>Plan</td><td>Standard</td></tr>
      <tr><td>Amount charged</td><td>$15.49</td></tr>
      <tr><td>Billing period</td><td>Monthly</td></tr>
      <tr><td>Next billing date</td><td>May 1, 2026</td></tr>
    </table></body></html>`,
  at: "2026-04-01T08:00:00Z",
  messageId: "<receipt-apr-2026@netflix.com>",
});

export const netflixPriceChange = mail({
  id: "m-netflix-price",
  from: NETFLIX,
  subject: "An update to your Netflix price",
  text: [
    "We're writing to let you know about a price change to your Standard plan.",
    "Your price will change from $15.49 to $17.99 per month starting with your billing date on June 1, 2026.",
  ].join("\n"),
  at: "2026-05-10T12:00:00Z",
});

export const netflixCancelled = mail({
  id: "m-netflix-cancel",
  from: NETFLIX,
  subject: "Your membership has been cancelled",
  text: [
    "We've cancelled your membership. We're sorry to see you go!",
    "You can keep watching until August 1, 2026.",
    "Restart your membership anytime.",
  ].join("\n"),
  at: "2026-07-15T18:30:00Z",
});

export const spotifyTrialStarted = mail({
  id: "m-spotify-trial",
  from: SPOTIFY,
  subject: "Your Premium trial has started",
  text: [
    "Welcome to your free trial of Spotify Premium Individual.",
    "Your free trial ends on October 4, 2026.",
    "After that you'll be charged PKR 299/month. Cancel anytime.",
  ].join("\n"),
  at: "2026-09-04T09:00:00Z",
});

export const spotifyTrialEnding = mail({
  id: "m-spotify-trial-ending",
  from: SPOTIFY,
  subject: "Your free trial ends in 3 days",
  text: [
    "Just a reminder: your Spotify Premium free trial ends on October 4, 2026.",
    "You'll be charged PKR 299/month after your trial ends.",
  ].join("\n"),
  at: "2026-10-01T09:00:00Z",
});

export const spotifyReceipt = mail({
  id: "m-spotify-receipt-oct",
  from: SPOTIFY,
  subject: "Your Spotify Premium receipt",
  text: [
    "Thanks for your payment!",
    "Your subscription to Spotify Premium Individual has been renewed.",
    "Total: PKR 299.00",
    "Billing: Monthly",
    "Next payment date: November 4, 2026",
  ].join("\n"),
  at: "2026-10-04T07:00:00Z",
});

export const youtubePromo = mail({
  id: "m-youtube-promo",
  from: "YouTube <noreply@youtube.com>",
  subject: "Get 3 months of YouTube Premium for $0 - limited time",
  text: "Try YouTube Premium free for 3 months. Subscribe now! Offer ends Oct 31.",
  at: "2026-09-20T15:00:00Z",
  labels: ["CATEGORY_PROMOTIONS"],
});

export const newsletterWelcome = mail({
  id: "m-newsletter",
  from: "Acme Weekly <hello@acmeweekly.com>",
  subject: "Thanks for subscribing!",
  text: "You're now subscribed to the Acme Weekly newsletter. Expect a digest every Friday.",
  at: "2026-08-02T11:00:00Z",
});

export const otpEmail = mail({
  id: "m-otp",
  from: "Google <no-reply@accounts.google.com>",
  subject: "Your verification code",
  text: "Your verification code is 123456. It expires in 10 minutes.",
  at: "2026-09-30T06:00:00Z",
});

export const personalReply = mail({
  id: "m-personal",
  from: "Ali Khan <ali.khan@gmail.com>",
  subject: "Re: netflix",
  text: "My Netflix subscription renews on Friday so lets split it. Your share is $8.",
  at: "2026-09-25T20:00:00Z",
});

export const uberReceipt = mail({
  id: "m-uber",
  from: "Uber Receipts <noreply@uber.com>",
  subject: "Your Thursday evening trip with Uber",
  text: "Thanks for riding, Nana. Total $12.40. Here's your receipt.",
  at: "2026-09-18T21:00:00Z",
});

/** Same email as netflixReceipt (same Message-ID) but under another provider id. */
export const netflixReceiptDuplicate = {
  ...netflixReceipt,
  providerMessageId: "m-netflix-receipt-apr-copy",
};

/** The full starting inbox (in delivery order). */
export const INBOX: RawEmailInput[] = [
  netflixWelcome,
  netflixReceipt,
  netflixPriceChange,
  netflixCancelled,
  newsletterWelcome,
  spotifyTrialStarted,
  uberReceipt,
  youtubePromo,
  personalReply,
  otpEmail,
  spotifyTrialEnding,
  netflixReceiptDuplicate,
];

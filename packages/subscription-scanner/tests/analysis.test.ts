import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyEmail } from "../src/classifier/classifier";
import { extractAmounts, parseDecimal } from "../src/extractor/amounts";
import { extractDates } from "../src/extractor/dates";
import { extractBillingFrequency } from "../src/extractor/frequency";
import {
  cleanDisplayName,
  registrableDomain,
  resolveProvider,
} from "../src/extractor/provider";
import { htmlToText } from "../src/collector/html-to-text";
import { INBOX, mail, normalized } from "./fixtures";

const RECEIVED = new Date("2026-12-20T10:00:00Z");

describe("amounts", () => {
  it("parses decimal and thousands separators", () => {
    assert.equal(parseDecimal("1,234.56"), "1234.56");
    assert.equal(parseDecimal("1.234,56"), "1234.56");
    assert.equal(parseDecimal("9,99"), "9.99");
    assert.equal(parseDecimal("1,500"), "1500");
    assert.equal(parseDecimal("12.5"), "12.5");
  });

  it("prefers the total over subtotal and tax", () => {
    const r = extractAmounts("Subtotal $9.99 | Tax $0.80 | Total $10.79");
    assert.deepEqual(r.price, { amountMinor: 1079, currency: "USD" });
  });

  it("reads suffix currencies and zero-decimal currencies", () => {
    assert.deepEqual(extractAmounts("Price: 9,99 € per month").price, {
      amountMinor: 999,
      currency: "EUR",
    });
    assert.deepEqual(extractAmounts("Total 1.234,56 EUR").price, {
      amountMinor: 123456,
      currency: "EUR",
    });
    assert.deepEqual(extractAmounts("Total: ¥1,200").price, {
      amountMinor: 1200,
      currency: "JPY",
    });
  });

  it('resolves "Rs" only when the currency is stated somewhere', () => {
    assert.deepEqual(extractAmounts("Amount charged: Rs. 1,500 (PKR)").price, {
      amountMinor: 150000,
      currency: "PKR",
    });
    assert.equal(extractAmounts("Amount charged: Rs. 1,500").price, null);
  });

  it("reports a tie between two different prices as ambiguous", () => {
    const r = extractAmounts("Choose $9.99/month or $99.99/year.");
    assert.equal(r.price, null);
    assert.equal(r.ambiguous, true);
  });

  it("detects old and new price in a price change", () => {
    const r = extractAmounts(
      "Your price will change from $15.49 to $17.99 per month.",
    );
    assert.deepEqual(r.previousPrice, { amountMinor: 1549, currency: "USD" });
    assert.deepEqual(r.price, { amountMinor: 1799, currency: "USD" });
  });

  it("does not treat a discount as the price", () => {
    assert.deepEqual(extractAmounts("Get $5 off. Plan price: $20.00").price, {
      amountMinor: 2000,
      currency: "USD",
    });
  });
});

describe("dates", () => {
  it("assigns roles from the nearest label", () => {
    const { dates } = extractDates(
      "Your free trial ends on October 4, 2026. Next billing date: Nov 4, 2026.",
      RECEIVED,
    );
    assert.equal(dates.trialEndDate, "2026-10-04");
    assert.equal(dates.renewalDate, "2026-11-04");
  });

  it("flags numeric dates with two valid readings instead of guessing", () => {
    const r = extractDates("Renewal date: 03/04/2027", RECEIVED);
    assert.equal(r.dates.renewalDate, undefined);
    assert.deepEqual(r.ambiguousRoles, ["renewalDate"]);
  });

  it("accepts numeric dates that only have one valid reading", () => {
    assert.equal(
      extractDates("Renewal date: 15/04/2027", RECEIVED).dates.renewalDate,
      "2027-04-15",
    );
  });

  it("infers a missing year from when the email arrived", () => {
    assert.equal(
      extractDates("Your plan renews on January 5.", RECEIVED).dates
        .renewalDate,
      "2027-01-05",
    );
  });

  it("handles Japanese and relative dates", () => {
    assert.equal(
      extractDates("次回更新 renews on 2027年1月15日", RECEIVED).dates
        .renewalDate,
      "2027-01-15",
    );
    assert.equal(
      extractDates("Your trial ends in 3 days.", RECEIVED).dates.trialEndDate,
      "2026-12-23",
    );
  });

  it("ignores dates without a label", () => {
    assert.deepEqual(
      extractDates("Posted on our blog, March 3, 2026.", RECEIVED).dates,
      {},
    );
  });
});

describe("billing frequency", () => {
  it("reads the period next to the price first", () => {
    assert.equal(
      extractBillingFrequency("$9.99/mo, billed annually after promo", 5),
      "monthly",
    );
  });
  it("does not mistake semi-annual for annual", () => {
    assert.equal(
      extractBillingFrequency("Billed semi-annual.", null),
      "semiannual",
    );
  });
});

describe("provider resolution", () => {
  it("reduces hosts to registrable domains", () => {
    assert.equal(registrableDomain("mailer.netflix.com"), "netflix.com");
    assert.equal(registrableDomain("mail.shop.co.uk"), "shop.co.uk");
  });

  it("cleans mailbox words from display names", () => {
    assert.equal(cleanDisplayName("Spotify Billing Team"), "Spotify");
    assert.equal(cleanDisplayName("no-reply"), null);
  });

  it("flags a payment-platform email whose merchant cannot be found", () => {
    const email = normalized(
      mail({
        id: "p1",
        from: "PayPal <service@paypal.com>",
        subject: "Receipt",
        text: "You paid $5.00.",
        at: "2026-09-01T00:00:00Z",
      }),
    );
    const r = resolveProvider(email);
    assert.equal(r.providerName, "PayPal");
    assert.equal(r.unresolvedMerchant, true);
  });

  it("maps a merchant behind PayPal to a known provider", () => {
    const email = normalized(
      mail({
        id: "p2",
        from: "PayPal <service@paypal.com>",
        subject: "Receipt for your payment to Spotify AB",
        text: "Automatic payment.",
        at: "2026-09-01T00:00:00Z",
      }),
    );
    const r = resolveProvider(email);
    assert.equal(r.providerName, "Spotify");
    assert.equal(r.billedVia, "PayPal");
  });
});

describe("html to text", () => {
  it("keeps table labels next to their values", () => {
    const text = htmlToText(
      "<table><tr><td>Total</td><td>&#36;10.79</td></tr></table><script>x()</script>",
    );
    assert.equal(text, "Total | $10.79");
  });
});

describe("classifier", () => {
  const decide = (id: string) => {
    const raw = INBOX.find((m) => m.providerMessageId === id);
    if (!raw) throw new Error(id);
    const c = classifyEmail(normalized(raw));
    return { decision: c.decision, eventType: c.eventType };
  };

  it("accepts real subscription events with the right type", () => {
    assert.deepEqual(decide("m-netflix-welcome"), {
      decision: "accept",
      eventType: "subscription_started",
    });
    assert.deepEqual(decide("m-netflix-receipt-apr"), {
      decision: "accept",
      eventType: "payment_succeeded",
    });
    assert.deepEqual(decide("m-netflix-price"), {
      decision: "accept",
      eventType: "price_changed",
    });
    assert.deepEqual(decide("m-netflix-cancel"), {
      decision: "accept",
      eventType: "cancelled",
    });
    assert.deepEqual(decide("m-spotify-trial"), {
      decision: "accept",
      eventType: "trial_started",
    });
    assert.deepEqual(decide("m-spotify-trial-ending"), {
      decision: "accept",
      eventType: "trial_ending",
    });
  });

  it("ignores promotions, newsletters, security codes, personal mail and one-off receipts", () => {
    for (const id of [
      "m-youtube-promo",
      "m-newsletter",
      "m-otp",
      "m-personal",
      "m-uber",
    ]) {
      assert.equal(decide(id).decision, "ignore", id);
    }
  });

  it('reads "will not renew" as a cancellation, not a renewal', () => {
    const email = normalized(
      mail({
        id: "c1",
        from: "Notion <team@makenotion.com>",
        subject: "Your Plus plan will not renew",
        text: "Auto-renewal has been turned off. Your subscription will not renew on Nov 3, 2026. You keep access until then.",
        at: "2026-10-01T00:00:00Z",
      }),
    );
    const c = classifyEmail(email);
    assert.equal(c.eventType, "cancelled");
    assert.equal(c.ambiguous, false);
  });
});

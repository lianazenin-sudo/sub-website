/**
 * Works out which company a subscription email is about.
 *
 * Order of preference:
 *   1. Payment platforms (Apple, Google Play, PayPal, Stripe…): the merchant
 *      named in the body ("Your subscription to Calm"), billed via the platform.
 *   2. A known provider matched by sender domain.
 *   3. The sender's display name, cleaned of words like "Billing Team".
 *   4. The sender's domain ("acme-cloud.io" → "Acme Cloud").
 */
import type { NormalizedEmail } from "../domain/types";

/**
 * - direct: the company sells its own subscriptions.
 * - mixed: sells its own AND bills for third parties (Apple, Google).
 * - intermediary: only processes payments for other merchants.
 */
type ProviderRole = "direct" | "mixed" | "intermediary";

interface KnownProvider {
  name: string;
  domains: readonly string[];
  role: ProviderRole;
}

/** Small starter catalogue. Unknown senders still work via steps 3–4. */
export const KNOWN_PROVIDERS: readonly KnownProvider[] = [
  { name: "Netflix", domains: ["netflix.com"], role: "direct" },
  { name: "Spotify", domains: ["spotify.com"], role: "direct" },
  { name: "YouTube", domains: ["youtube.com"], role: "direct" },
  { name: "Apple", domains: ["apple.com", "itunes.com"], role: "mixed" },
  { name: "Google", domains: ["google.com"], role: "mixed" },
  {
    name: "Amazon",
    domains: [
      "amazon.com",
      "amazon.co.uk",
      "amazon.de",
      "amazon.co.jp",
      "amazon.in",
      "amazon.ae",
    ],
    role: "direct",
  },
  { name: "Prime Video", domains: ["primevideo.com"], role: "direct" },
  { name: "Audible", domains: ["audible.com"], role: "direct" },
  { name: "Disney+", domains: ["disneyplus.com"], role: "direct" },
  { name: "Hulu", domains: ["hulu.com"], role: "direct" },
  { name: "Max", domains: ["max.com", "hbomax.com"], role: "direct" },
  { name: "Paramount+", domains: ["paramountplus.com"], role: "direct" },
  { name: "Crunchyroll", domains: ["crunchyroll.com"], role: "direct" },
  { name: "Adobe", domains: ["adobe.com"], role: "direct" },
  { name: "Microsoft", domains: ["microsoft.com"], role: "direct" },
  { name: "Xbox", domains: ["xbox.com"], role: "direct" },
  { name: "PlayStation", domains: ["playstation.com"], role: "direct" },
  {
    name: "Nintendo",
    domains: ["nintendo.com", "nintendo.net"],
    role: "direct",
  },
  { name: "Dropbox", domains: ["dropbox.com"], role: "direct" },
  { name: "Notion", domains: ["notion.so", "makenotion.com"], role: "direct" },
  { name: "Figma", domains: ["figma.com"], role: "direct" },
  { name: "Canva", domains: ["canva.com"], role: "direct" },
  { name: "GitHub", domains: ["github.com"], role: "direct" },
  { name: "OpenAI", domains: ["openai.com"], role: "direct" },
  { name: "Anthropic", domains: ["anthropic.com"], role: "direct" },
  { name: "Slack", domains: ["slack.com"], role: "direct" },
  { name: "Zoom", domains: ["zoom.us", "zoom.com"], role: "direct" },
  { name: "LinkedIn", domains: ["linkedin.com"], role: "direct" },
  { name: "Duolingo", domains: ["duolingo.com"], role: "direct" },
  { name: "Medium", domains: ["medium.com"], role: "direct" },
  { name: "Patreon", domains: ["patreon.com"], role: "direct" },
  { name: "Grammarly", domains: ["grammarly.com"], role: "direct" },
  { name: "1Password", domains: ["1password.com"], role: "direct" },
  {
    name: "NordVPN",
    domains: ["nordvpn.com", "nordaccount.com"],
    role: "direct",
  },
  { name: "Squarespace", domains: ["squarespace.com"], role: "direct" },
  { name: "Vercel", domains: ["vercel.com"], role: "direct" },
  { name: "PayPal", domains: ["paypal.com"], role: "intermediary" },
  { name: "Stripe", domains: ["stripe.com"], role: "intermediary" },
  {
    name: "Paddle",
    domains: ["paddle.com", "paddle.net"],
    role: "intermediary",
  },
  { name: "FastSpring", domains: ["fastspring.com"], role: "intermediary" },
  {
    name: "Lemon Squeezy",
    domains: ["lemonsqueezy.com"],
    role: "intermediary",
  },
  { name: "Gumroad", domains: ["gumroad.com"], role: "intermediary" },
];

/** Words that name a plan tier rather than a company ("YouTube Premium"). */
export const TIER_WORDS = [
  "Premium",
  "Plus",
  "Pro",
  "Basic",
  "Standard",
  "Family",
  "Individual",
  "Duo",
  "Student",
  "Business",
  "Team",
  "Teams",
  "Enterprise",
  "Personal",
  "Ultimate",
  "Lite",
  "Starter",
  "Essentials",
  "Advanced",
  "Unlimited",
] as const;
const TIER_SET = new Set(TIER_WORDS.map((w) => w.toLowerCase()));

/** Second-level labels that form a public suffix with a 2-letter TLD (co.uk, com.pk). */
const MULTI_PART_SECOND_LEVEL = new Set([
  "co",
  "com",
  "org",
  "net",
  "ac",
  "gov",
  "edu",
  "ne",
  "or",
  "go",
]);

/** Display-name words that describe a mailbox, not a company. */
const GENERIC_SENDER_WORDS =
  /\b(?:billing|team|support|notifications?|no-?reply|noreply|do not reply|receipts?|accounts?|payments?|customer (?:service|care)|info|hello|help|mailer|news|updates?|services?|the)\b/gi;

/** Legal suffixes stripped from merchant names ("Spotify AB" → "Spotify"). */
const CORPORATE_SUFFIX =
  /[,\s]+(?:inc\.?|llc|ltd\.?|limited|gmbh|ab|b\.?v\.?|s\.?a\.?|plc|corp\.?|co\.)$/i;

/** Captured merchant names that are clearly not merchants. */
const NOT_A_MERCHANT = new Set([
  "your",
  "the",
  "this",
  "our",
  "my",
  "apple id",
  "account",
  "you",
]);

/**
 * Patterns that name the merchant inside a payment-platform email. A name is
 * 1–4 capitalised words; lowercase words end it ("subscription to Calm has").
 */
const MERCHANT_NAME = String.raw`((?:[A-Z0-9]|i(?=[A-Z]))[\w&+.'-]*(?:\s(?:[A-Z0-9+&]|i(?=[A-Z]))[\w&+.'-]*){0,3})`;
const MERCHANT_PATTERNS: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:subscription|membership|plan) (?:to|for|from|with) ${MERCHANT_NAME}`,
  ),
  new RegExp(
    String.raw`\b(?:payment|paid|receipt|charge) (?:to|from|for) ${MERCHANT_NAME}`,
  ),
  /^(?:App|Merchant|Seller|Store|Service|Product|Paid to)\s*:?\s+([^\n]{2,60})$/m,
];

/**
 * Reduces a hostname to its registrable domain ("mailer.netflix.com" →
 * "netflix.com", "mail.shop.co.uk" → "shop.co.uk"). A heuristic, not the full
 * Public Suffix List: good enough to name a sender, never used for security.
 */
export function registrableDomain(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const tld = labels[labels.length - 1] ?? "";
  const secondLevel = labels[labels.length - 2] ?? "";
  const take =
    tld.length === 2 && MULTI_PART_SECOND_LEVEL.has(secondLevel) ? 3 : 2;
  return labels.slice(-take).join(".");
}

/** Finds the known provider whose domain is the sender domain or a parent of it. */
export function findKnownProvider(domain: string): KnownProvider | null {
  const host = domain.toLowerCase();
  return (
    KNOWN_PROVIDERS.find((p) =>
      p.domains.some((d) => host === d || host.endsWith(`.${d}`)),
    ) ?? null
  );
}

/** True when the sender is a known provider that sells subscriptions itself. */
export function isKnownSubscriptionSender(domain: string): boolean {
  const known = findKnownProvider(domain);
  return known !== null && known.role !== "intermediary";
}

/**
 * Turns a provider name into the stable key used for matching:
 * "Disney+" → "disneyplus", "Prime Video" → "primevideo".
 */
export function providerKeyFor(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
  return key.length > 0 ? key : "unknown";
}

/**
 * Cleans a From display name ("Spotify Billing Team" → "Spotify"). Returns
 * null if nothing meaningful is left or it's really an email address.
 */
export function cleanDisplayName(name: string | null): string | null {
  if (!name || name.includes("@")) return null;
  const cleaned = name
    .replace(/\bvia\b.*$/i, "")
    .replace(GENERIC_SENDER_WORDS, " ")
    .replace(/[|•·:–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 120) : null;
}

/** Last-resort name from a domain: "acme-cloud.io" → "Acme Cloud". */
export function nameFromDomain(domain: string): string {
  const label = registrableDomain(domain).split(".")[0] ?? domain;
  const words = label.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return "Unknown";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Splits trailing plan-tier words off a merchant string:
 * "YouTube Premium" → { name: "YouTube", tier: "Premium" }. A name that is
 * only tier words (e.g. "Max") is left intact.
 */
export function splitTier(merchant: string): {
  name: string;
  tier: string | null;
} {
  const words = merchant.split(/\s+/).filter(Boolean);
  let cut = words.length;
  while (cut > 1 && TIER_SET.has((words[cut - 1] ?? "").toLowerCase()))
    cut -= 1;
  const tierWords = words.slice(cut);
  return {
    name: words.slice(0, cut).join(" "),
    tier: tierWords.length > 0 ? tierWords.join(" ") : null,
  };
}

/** Trims punctuation and legal suffixes from a captured merchant name. */
function tidyMerchant(raw: string): string {
  return raw
    .trim()
    .replace(/[.,;:!)\]]+$/, "")
    .replace(/\s*\((?:monthly|yearly|annual|weekly)\)$/i, "")
    .replace(CORPORATE_SUFFIX, "")
    .trim();
}

/**
 * Finds the real merchant in an email sent by a payment platform
 * ("Your subscription to Calm Premium has been renewed" → "Calm Premium").
 * Ignores captures that are generic words or the platform itself.
 */
export function extractMerchant(
  text: string,
  intermediaryName: string,
): string | null {
  const ownKey = providerKeyFor(intermediaryName);
  for (const pattern of MERCHANT_PATTERNS) {
    const match = pattern.exec(text);
    const candidate = match?.[1] ? tidyMerchant(match[1]) : "";
    if (candidate.length < 2 || candidate.length > 60) continue;
    if (NOT_A_MERCHANT.has(candidate.toLowerCase())) continue;
    if (providerKeyFor(candidate) === ownKey) continue;
    return candidate;
  }
  return null;
}

/**
 * Maps a merchant name onto a known provider when it clearly is one
 * ("Spotify AB" → Spotify). Requires a key of 4+ characters for prefix
 * matches so short names like "Max" don't swallow unrelated merchants.
 */
function canonicalKnownName(name: string): string | null {
  const key = providerKeyFor(name);
  const exact = KNOWN_PROVIDERS.find((p) => providerKeyFor(p.name) === key);
  if (exact) return exact.name;
  const prefix = KNOWN_PROVIDERS.find((p) => {
    const pk = providerKeyFor(p.name);
    return pk.length >= 4 && key.startsWith(pk);
  });
  return prefix?.name ?? null;
}

export interface ResolvedProvider {
  providerKey: string;
  providerName: string;
  /** Payment platform that billed on the merchant's behalf, if any. */
  billedVia: string | null;
  /** Tier found inside the merchant name ("Premium"), used as a plan hint. */
  planHint: string | null;
  /** True when a pure payment platform sent it and no merchant could be found. */
  unresolvedMerchant: boolean;
}

/** Decides which company an email is about (see the order at the top of this file). */
export function resolveProvider(email: NormalizedEmail): ResolvedProvider {
  const text = `${email.subject}\n${email.text}`;
  const known = findKnownProvider(email.from.domain);

  if (known && known.role !== "direct") {
    const merchant = extractMerchant(text, known.name);
    if (merchant) {
      const { name, tier } = splitTier(merchant);
      const providerName = canonicalKnownName(name) ?? name;
      return {
        providerKey: providerKeyFor(providerName),
        providerName,
        billedVia: known.name,
        planHint: tier,
        unresolvedMerchant: false,
      };
    }
    if (known.role === "intermediary") {
      return {
        providerKey: providerKeyFor(known.name),
        providerName: known.name,
        billedVia: known.name,
        planHint: null,
        unresolvedMerchant: true,
      };
    }
  }

  if (known) {
    return {
      providerKey: providerKeyFor(known.name),
      providerName: known.name,
      billedVia: null,
      planHint: null,
      unresolvedMerchant: false,
    };
  }

  const providerName =
    cleanDisplayName(email.from.name) ?? nameFromDomain(email.from.domain);
  return {
    providerKey: providerKeyFor(providerName),
    providerName,
    billedVia: null,
    planHint: null,
    unresolvedMerchant: false,
  };
}

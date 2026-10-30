export const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

/** Discord community invite. Override with NEXT_PUBLIC_DISCORD_INVITE_URL. */
export const discordInviteUrl =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/UepYWjjMK";

export const featureCards = [
  {
    id: "subscriptions",
    title: "See all your subscriptions in one place",
    kind: "dashboard" as const,
  },
  {
    id: "alerts",
    title: "Get alerts for renewals, free trials, and price hikes",
    kind: "alerts" as const,
  },
  {
    id: "spend",
    title: "Cancel what you don't need. Subscribe to what you do.",
    kind: "spend" as const,
    amount: "$204",
    caption: "saved this month",
  },
];

export const householdFeatures = [
  "Find your subscriptions automatically",
  "Detect prices and renewal dates",
  "Identify subscriptions across multiple emails",
  "Alert you about renewals and price changes",
  "Help you manage or cancel subscriptions",
];

export const plans = {
  monthly: {
    label: "Monthly",
    period: "1 Month",
    billing: "Billed monthly",
    price: "$4.99",
  },
  yearly: {
    label: "Yearly",
    period: "1 Year",
    billing: "Billed yearly",
    price: "$12.99",
  },
} as const;

export type PlanKey = keyof typeof plans;

export const faqs = [
  {
    q: "What is Trace?",
    a: "Trace is one home for every subscription in your household. It shows what you pay, when it renews, and what is worth keeping.",
  },
  {
    q: "How does Trace find my subscriptions?",
    a: "Connect your email and Trace reads receipts and renewal notices. Price, date, and service land in one list.",
  },
  {
    q: "Is my email safe?",
    a: "Trace only looks at messages that look like bills and receipts. You can disconnect your email at any time.",
  },
  {
    q: "Can I disconnect my email and delete my data?",
    a: "Yes. Disconnecting stops new imports, and you can delete the subscriptions Trace has stored.",
  },
  {
    q: "Can Trace track a household plan?",
    a: "Unlimited is built for a household, so everyone's subscriptions sit in the same home.",
  },
  {
    q: "Can Trace cancel a subscription for me?",
    a: "Trace shows the renewal and where to cancel, then reminds you before the next charge. You confirm it with the service.",
  },
  {
    q: "How does the free trial work?",
    a: "Unlimited starts with 14 days free. Cancel before it ends and you won't be charged.",
  },
  {
    q: "Can I switch between monthly and yearly?",
    a: "Yes. Monthly is $4.99. You can move to yearly, or back, whenever you want.",
  },
];

export const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy-policy", label: "Privacy" },
    ],
  },
];

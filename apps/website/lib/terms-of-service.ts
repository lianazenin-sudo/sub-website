import type { PolicySection } from "@/components/policy-page";

// Items marked "(confirm)" are not yet decided and must be filled in before launch.

export const termsUpdated = "November 3, 2026";

export const termsIntro =
  "These terms explain the rules for using Trace, the app and website at jointraceapp.com that helps you find, track, and manage your subscriptions and recurring payments. Please read them carefully. They apply when you use the Trace website, the Trace app, and any account you connect.";

const privacyLink = { label: "Privacy Policy", href: "/privacy-policy" };

export const termsSections: readonly PolicySection[] = [
  {
    id: "acceptance",
    title: "Accepting These Terms",
    blocks: [
      {
        type: "p",
        text: "By creating an account or using Trace, you agree to these terms. If you do not agree, please do not use Trace.",
      },
      {
        type: "p",
        text: "You must be at least 13 years old, or the minimum age required where you live if that is higher (confirm), to use Trace. If you use Trace on behalf of someone else, you confirm you have their permission.",
      },
    ],
  },
  {
    id: "the-service",
    title: "What Trace Does",
    blocks: [
      {
        type: "p",
        text: "Trace is a subscription and recurring-payment management app, built for Android first. It helps you:",
      },
      {
        type: "list",
        items: [
          "Find subscriptions and recurring payments in the email inboxes you choose to connect.",
          "Track renewals, free trials, price changes, failed payments, and cancellations.",
          "Browse a marketplace of plans from 400+ companies.",
          "Get help cancelling subscriptions you no longer want.",
        ],
      },
      {
        type: "p",
        text: "Trace does not send, delete, or change your email. It does not move money for you, and it is not a bank. Linking a bank account or card is not available at launch. Features that depend on it, and virtual cards, are planned but not guaranteed.",
      },
    ],
  },
  {
    id: "accounts",
    title: "Your Account and Security",
    blocks: [
      {
        type: "p",
        text: "You are responsible for the information you give us and for keeping your sign-in details safe. Use accurate details and keep them up to date.",
      },
      {
        type: "p",
        text: "You are responsible for activity on your account. If you think someone else has accessed it, contact us right away.",
      },
    ],
  },
  {
    id: "connected-email",
    title: "Connecting Email Accounts",
    blocks: [
      {
        type: "p",
        text: "To find your subscriptions, Trace asks for read-only access to the Gmail accounts you choose to connect, using Google’s gmail.readonly permission. Trace reads messages such as receipts, bills, and renewal notices. It cannot send, delete, or change your email.",
      },
      {
        type: "p",
        text: "Trace does not sell your data, and it does not use your email data for advertising or to train generalized AI models. Trace’s use of Google user data follows the Google API Services User Data Policy, including the Limited Use requirements. For details, see our {link}.",
        link: privacyLink,
      },
      {
        type: "list",
        items: [
          "You can disconnect an email account in Trace at any time. Disconnecting stops new imports.",
          "You can also revoke Trace’s access at any time from your Google Account’s security settings.",
          "You can delete your Trace account, which removes your account and the subscription data we stored for it.",
        ],
      },
      {
        type: "p",
        text: "Only connect email accounts that you own or are allowed to use.",
      },
    ],
  },
  {
    id: "billing",
    title: "Subscriptions, Billing, and Refunds",
    blocks: [
      {
        type: "p",
        text: "Trace has a free plan that tracks up to 4 subscriptions. Trace Premium costs $4.99 a month or $24.99 a year (confirm: the website’s pricing section currently shows $12.99 a year). Prices may include or exclude tax depending on where you live.",
      },
      {
        type: "list",
        items: [
          "On Android, Premium is billed through Google Play Billing, using the payment method in your Google Play account.",
          "Premium renews automatically at the end of each billing period until you cancel it.",
          "If a free trial is offered, you will be charged when it ends unless you cancel before then.",
          "You can cancel at any time in Google Play. Cancelling stops future renewals, and you keep Premium until the end of the period you already paid for.",
          "Refunds are handled under Google Play’s refund policies.",
        ],
      },
      {
        type: "p",
        text: "Marketplace commissions and virtual cards, when they become available, may carry fees. We will show any fee before it applies.",
      },
    ],
  },
  {
    id: "marketplace",
    title: "The Marketplace and Cancellations",
    blocks: [
      {
        type: "p",
        text: "The marketplace shows plans sold by other companies. Trace is not the seller of those services. Your purchase, the service itself, and its terms are between you and that company.",
      },
      {
        type: "p",
        text: "When Trace helps you cancel a subscription, the result depends on the other company and its rules. Trace does not guarantee that a cancellation will succeed, or that a charge will be stopped or refunded. Always check with the company that the cancellation went through.",
      },
    ],
  },
  {
    id: "accuracy",
    title: "Accuracy of Information",
    blocks: [
      {
        type: "p",
        text: "Trace finds subscriptions from your emails using automated detection. Results may be incomplete, out of date, or wrong. For example, a price, date, or renewal may be missed or misread.",
      },
      {
        type: "p",
        text: "Please check important charges, renewal dates, and cancellations yourself with your bank, card provider, or the company involved.",
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    blocks: [
      { type: "p", text: "When you use Trace, you agree not to:" },
      {
        type: "list",
        items: [
          "Connect email accounts you do not own or have permission to use.",
          "Misuse Trace, interfere with it, or try to access it in ways we do not allow.",
          "Copy, reverse engineer, decompile, or try to extract the source code of Trace, except where the law allows it.",
          "Use Trace for anything illegal, harmful, or fraudulent.",
          "Use bots or automated tools to access Trace without our permission.",
        ],
      },
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    blocks: [
      {
        type: "p",
        text: "Trace, including its software, design, the Trace name, and the Trace logo and mascot, belongs to us and is protected by law. These terms do not give you any right to use our name or logo.",
      },
      {
        type: "p",
        text: "You keep ownership of your own content and data. You allow us to use it only to run and improve Trace for you, as described in our {link}.",
        link: privacyLink,
      },
    ],
  },
  {
    id: "third-parties",
    title: "Third-Party Services and Links",
    blocks: [
      {
        type: "p",
        text: "Trace works with services run by other companies, such as Google for sign-in, Gmail, and Google Play, and the companies in the marketplace. Your use of those services is covered by their own terms and policies. We are not responsible for them.",
      },
      {
        type: "p",
        text: "Trace may link to other websites. We do not control them and are not responsible for their content.",
      },
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    blocks: [
      {
        type: "p",
        text: "Trace is provided “as is” and “as available”. To the extent the law allows, we do not promise that Trace will always be available, error-free, or that it will find every subscription or charge.",
      },
      {
        type: "p",
        text: "Trace is not financial, legal, or tax advice. Talk to a qualified professional about decisions in those areas.",
      },
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    blocks: [
      {
        type: "p",
        text: "To the extent the law allows, Trace is not liable for indirect or consequential losses, or for charges, fees, or losses caused by missed renewals, incorrect information, or cancellations that did not go through.",
      },
      {
        type: "p",
        text: "Where we are liable, our total liability is limited to the amount you paid us for Trace in the 12 months before the claim (confirm). Nothing in these terms limits rights you have under consumer laws that cannot be excluded.",
      },
    ],
  },
  {
    id: "termination",
    title: "Suspension and Termination",
    blocks: [
      {
        type: "p",
        text: "You can stop using Trace and delete your account at any time.",
      },
      {
        type: "p",
        text: "We may suspend or close your account if you break these terms, misuse Trace, or if we must do so by law. Where it is reasonable, we will tell you first. If we stop offering Trace, we will give you notice where we can.",
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to These Terms and to Trace",
    blocks: [
      {
        type: "p",
        text: "We may update these terms and change or remove features as Trace develops. When we update the terms, we will change the date at the top of this page.",
      },
      {
        type: "p",
        text: "If a change is material, we will give you clearer notice, such as an email or a message in the app, before it takes effect. If you keep using Trace after a change takes effect, you accept the updated terms.",
      },
    ],
  },
  {
    id: "governing-law",
    title: "Governing Law and Disputes",
    blocks: [
      {
        type: "p",
        text: "These terms are governed by the laws of (confirm). Any disputes will be handled in (confirm).",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    blocks: [
      {
        type: "p",
        text: "Questions about these terms can be sent to support@jointraceapp.com. You can also reach us from the contact link in the footer.",
      },
    ],
  },
];

export const policyUpdated = "September 30, 2026";

export const policyIntro =
  "Trace helps you see and manage the subscriptions connected to your household. This policy explains what we collect, how we use it, and the choices you have. It applies when you use the Trace website, the Trace app, and any account you connect.";

export const policySections = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    blocks: [
      {
        type: "p" as const,
        text: "We collect only what we need to show your subscriptions in one place and to keep your account working.",
      },
      {
        type: "list" as const,
        items: [
          "Account details you give us, such as your name, email address, and username.",
          "Subscription details we find or you add, including the service name, price, billing period, and renewal date.",
          "Messages that look like receipts, bills, and renewal notices, when you connect an email account.",
          "Basic device and usage data, such as the browser you use and pages you open on this site.",
        ],
      },
    ],
  },
  {
    id: "how-we-use-your-information",
    title: "How We Use Your Information",
    blocks: [
      {
        type: "p" as const,
        text: "We use this information to run Trace for you. We do not sell your personal information.",
      },
      {
        type: "list" as const,
        items: [
          "Build the list of subscriptions for your household.",
          "Warn you before a renewal, a free trial ends, or a price changes.",
          "Keep your account signed in and help you recover it.",
          "Answer a message you send us, and send product notes if you ask for them.",
          "Protect Trace against abuse and keep the service reliable.",
        ],
      },
    ],
  },
  {
    id: "how-gmail-data-is-used",
    title: "How Gmail Data Is Used",
    blocks: [
      {
        type: "p" as const,
        text: "If you connect Gmail, Trace reads only the messages it needs to find subscriptions. That means receipts, bills, and renewal notices. We use what we find to fill in the service, the price, and the date.",
      },
      {
        type: "p" as const,
        text: "Gmail data is not used for advertising. We do not sell it, and we do not use it to train public models. We do not let other people read your mail. Trace’s use of Google user data follows the Google API Services User Data Policy, including the Limited Use requirements.",
      },
      {
        type: "p" as const,
        text: "You can disconnect Gmail at any time. Disconnecting stops new imports. You can also delete the subscriptions Trace stored from that account.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    blocks: [
      {
        type: "p" as const,
        text: "We protect account data in transit and at rest. Access to customer information is limited to what is needed to run Trace. No method of storage or transmission is perfectly secure, and we cannot promise that unauthorized access will never happen.",
      },
      {
        type: "p" as const,
        text: "If we learn of a breach that affects your account, we will tell you as required by law.",
      },
    ],
  },
  {
    id: "connected-accounts",
    title: "Connected Accounts",
    blocks: [
      {
        type: "p" as const,
        text: "You can sign in with Google and connect an email inbox so Trace can find subscriptions. We store the connection only for as long as you leave it on.",
      },
      {
        type: "list" as const,
        items: [
          "You choose which account to connect.",
          "You can disconnect it from your Trace settings.",
          "Disconnecting does not delete mail in Gmail. It stops Trace from reading new messages.",
          "Deleting your Trace account removes the subscription data we stored for you.",
        ],
      },
    ],
  },
  {
    id: "childrens-privacy",
    title: "Children's Privacy",
    blocks: [
      {
        type: "p" as const,
        text: "Trace is not for children under 13, and we do not knowingly collect personal information from them. If you believe a child has given us information, contact us and we will delete it.",
      },
    ],
  },
  {
    id: "changes-to-this-policy",
    title: "Changes to This Policy",
    blocks: [
      {
        type: "p" as const,
        text: "We may update this policy as Trace changes. When we do, we will change the date at the top of this page. If a change materially affects how we use information we already have, we will give you a clearer notice, such as an email or a message in the product.",
      },
    ],
  },
  {
    id: "contact-us",
    title: "Contact Us",
    blocks: [
      {
        type: "p" as const,
        text: "Questions about this policy or your data can be sent to privacy@trace.app. You can also reach us from the contact link in the footer.",
      },
    ],
  },
];

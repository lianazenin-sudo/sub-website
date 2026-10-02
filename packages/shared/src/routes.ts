/** App route paths shared by web and mobile navigation. */
export const ROUTES = {
  onboarding: "/onboarding",
  createAccount: "/create-account",
  enterEmail: "/enter-email",
  createUsername: "/create-username",
  scanning: "/scanning",
  welcomeBack: "/welcome-back",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Primary onboarding funnel order after the intro screen:
 * create-account → enter-email → create-username → scanning
 */
export const ONBOARDING_FLOW = [
  ROUTES.createAccount,
  ROUTES.enterEmail,
  ROUTES.createUsername,
  ROUTES.scanning,
] as const;

export type OnboardingFlowRoute = (typeof ONBOARDING_FLOW)[number];

# Trace

Monorepo for the Trace subscription product.

## Layout

- **apps/website** — Next.js website and API (onboarding, privacy policy, contact). Web only.
- **apps/mobile** — Expo + React Native app (iOS and Android). Not created yet.
- **packages/shared** — Platform-independent code only (`@trace/shared`).
- **packages/subscription-scanner** — Server-side email scanner. Never imported by mobile.

## Rule

Website code and mobile code never import each other. They share code only through `packages/shared`.

## Scripts

- `npm run dev:website` — run the Next.js website
- `npm run build:website` — production build for the website
- `npm run lint` — lint the website
- `npm run dev:mobile` — reserved for the Expo app (step 7)

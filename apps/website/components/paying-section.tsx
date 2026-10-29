"use client";

import Image from "next/image";
import { MagneticButton } from "@/components/magnetic-button";
import { SectionLabel } from "@/components/section-label";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

/** One screenshot: a snap slide on phones and tablets, a grid cell on desktop. */
const slide = "w-[78%] max-w-[340px] shrink-0 snap-center sm:w-[44%] lg:w-auto lg:max-w-none lg:min-w-0";

const phones = {
  dashboard: {
    src: "/assets/paying/dashboard.png",
    width: 557,
    height: 869,
    alt: "Home screen showing $278.01 a month and upcoming renewals for Notion, Netflix, Figma, and Adobe.",
  },
  inboxes: {
    src: "/assets/paying/inboxes.png",
    width: 500,
    height: 800,
    alt: "Subscription list with email accounts tagged across Netflix, Claude, FitPulse, Disney+, and Hulu.",
  },
  disney: {
    src: "/assets/paying/disney.png",
    width: 528,
    height: 900,
    alt: "Disney+ yearly plan at $139.99 with a cancellation timeline.",
  },
  purchased: {
    src: "/assets/paying/purchased.png",
    width: 528,
    height: 900,
    alt: "Subscription purchased confirmation over the plan list.",
  },
} as const;

export function PayingSection() {
  const ref = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      id="paying"
      aria-labelledby="paying-heading"
      className="scroll-mt-24 overflow-visible px-6"
    >
      <div className="mx-auto w-full max-w-[1280px] overflow-visible">
        <div className="flex justify-center" data-reveal>
          <SectionLabel>What Are You Paying For</SectionLabel>
        </div>

        <div className="mt-10 grid grid-cols-1 items-start gap-8 overflow-visible lg:mt-12 lg:grid-cols-3">
          <div className="order-1 min-w-0 text-center lg:col-start-2 lg:row-start-1">
            <div className="mx-auto w-full max-w-[420px]">
              <PayingCopy />
            </div>
          </div>

          <div
            className={cn(
              "order-2 -mx-6 flex snap-x snap-mandatory items-center gap-4 overflow-x-auto scroll-px-6 px-6 pb-2",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "lg:contents",
            )}
            role="region"
            aria-label="App screenshots"
            tabIndex={0}
          >
          <div className={cn(slide, "order-2 lg:col-start-1 lg:row-start-1")}>
            <PhoneShot {...phones.dashboard} />
          </div>
          <div className={cn(slide, "order-3 lg:col-start-3 lg:row-start-1")}>
            <PhoneShot {...phones.inboxes} />
          </div>
          <div className={cn(slide, "order-4 lg:col-start-1 lg:row-start-2")}>
            <PhoneShot {...phones.disney} />
          </div>

          <div className={cn(slide, "order-5 lg:col-start-2 lg:row-start-2")}>
            <Image
              src="/assets/paying/alerts.png"
              alt="Alerts for a trial ending, an unused subscription, a Netflix renewal, a new charge, and a confirmed cancellation."
              width={581}
              height={664}
              unoptimized
              className="mx-auto block h-auto w-full object-contain"
            />
          </div>

          <div className={cn(slide, "order-6 lg:col-start-3 lg:row-start-2")}>
            <PhoneShot {...phones.purchased} />
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneShot({
  src,
  width,
  height,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className="mx-auto block h-auto w-full max-w-[340px] object-contain"
    />
  );
}

function PayingCopy() {
  return (
    <>
      <h2
        id="paying-heading"
        className="text-xl font-bold tracking-[-0.03em] text-white sm:text-[1.65rem] sm:leading-snug"
      >
        Every Subscription, Found Automatically. All Your Inboxes, One Dashboard.
      </h2>
      <p className="mt-4 text-center text-[13px] leading-[1.6] tracking-normal text-fog [word-spacing:normal] sm:text-sm">
        Nothing to enter by hand. Connect as many Gmail accounts as you use, five or
        more, with read-only access, and we find every subscription from receipts and
        renewal notices. They all appear in one dashboard, sorted by what renews next,
        with a label showing which account each came from. We support 400+ providers.
        So you can buy a new plan, switch to a better one, or cancel anytime without
        leaving the app. Smart renewals show what&apos;s charging next, warn you before
        trials end and price hikes land, and flag duplicates when the same service is
        billed on two addresses. Filter by account, or view everything combined to see
        your true monthly total.
      </p>
      <div className="mt-6 flex justify-center">
        <MagneticButton href="https://discord.gg/UepYWjjMK" className="h-12 px-10">
          Join on Discord
        </MagneticButton>
      </div>
    </>
  );
}

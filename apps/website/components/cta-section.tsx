"use client";

import Image from "next/image";
import { useReveal } from "@/hooks/use-reveal";
import { WaitlistForm } from "@/components/waitlist-form";

export function CtaSection() {
  const ref = useReveal<HTMLElement>();

  return (
    <section ref={ref} aria-labelledby="cta-heading" className="site-wrap">
      <div
        data-reveal
        className="relative overflow-hidden rounded-[2rem] bg-[#7a6bc4] px-6 py-16 text-center sm:px-10 sm:py-20 md:py-24"
      >
        <Image
          src="/assets/gradient-banner.jpg"
          alt=""
          fill
          sizes="(min-width: 1156px) 1156px, 100vw"
          className="object-cover"
        />
        <div className="relative z-10 mx-auto max-w-2xl">
          <p className="text-sm font-medium text-white/80">
            Your subscriptions, finally in one place.
          </p>
          <h2
            id="cta-heading"
            className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl lg:text-display"
          >
            Get Started.
            <span className="mt-1 flex items-center justify-center gap-3">
              Meet
              <Image
                src="/assets/mascot-head.png"
                alt=""
                width={122}
                height={81}
                className="inline-block h-10 w-auto sm:h-12"
              />
              Trace.
            </span>
          </h2>
          <div className="mt-8 flex justify-center">
            <WaitlistForm source="cta" />
          </div>
        </div>
      </div>
    </section>
  );
}

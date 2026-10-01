"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { featureCards } from "@/lib/site-content";
import { duration, easeOut } from "@/lib/motion";
import { useReveal } from "@/hooks/use-reveal";
import { SectionLabel } from "@/components/section-label";
import { MagneticButton } from "@/components/magnetic-button";

export function FeatureSection() {
  const ref = useReveal<HTMLElement>();
  const reduce = useReducedMotion();

  return (
    <section
      ref={ref}
      id="features"
      aria-labelledby="features-heading"
      className="site-wrap scroll-mt-24 py-16 md:py-24"
    >
      <div className="flex justify-center" data-reveal>
        <SectionLabel as="h2" id="features-heading">
          Features
        </SectionLabel>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:gap-6">
        {featureCards.map((card) => (
          <div key={card.id} data-reveal>
          <motion.article
            whileHover={reduce ? undefined : { y: -8, scale: 1.02 }}
            transition={{ duration: duration.fast, ease: easeOut }}
            className="group relative flex min-h-[32rem] flex-col overflow-hidden rounded-card p-6 sm:p-7"
          >
            {card.kind === "alerts" ? (
              <div className="absolute inset-0 bg-ink-card" aria-hidden="true" />
            ) : (
              <>
                <div className="absolute inset-0 bg-[#816fca]" aria-hidden="true" />
                <Image
                  src="/assets/gradient-card.png"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 360px, 100vw"
                  className="object-cover"
                />
              </>
            )}

            <div className="relative z-10 flex flex-1 flex-col">
              <h3 className="text-center text-lg font-semibold leading-snug text-white sm:text-xl">
                {card.title}
              </h3>

              {card.kind === "dashboard" ? (
                <div className="mt-6 overflow-hidden rounded-[1.25rem]">
                  <Image
                    src="/assets/dashboard.png"
                    alt="Subscription dashboard with monthly spend, renewals, and active plans"
                    width={407}
                    height={451}
                    className="h-auto w-full origin-center transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                </div>
              ) : null}

              {card.kind === "alerts" ? (
                <>
                  <div className="flex flex-1 items-center justify-center py-6">
                    <Image
                      src="/assets/alerts.png"
                      alt=""
                      width={255}
                      height={284}
                      className="h-auto w-[78%] max-w-[240px] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    />
                  </div>
                  <MagneticButton href="#pricing" className="w-full">
                    Get alerts
                  </MagneticButton>
                </>
              ) : null}

              {card.kind === "spend" ? (
                <div className="flex flex-1 flex-col items-center justify-center pb-4 text-center">
                  <span className="grid size-14 place-items-center rounded-full bg-white/25 text-white">
                    <CheckIcon />
                  </span>
                  <p className="mt-5 text-6xl font-extrabold tracking-[-0.04em] text-white sm:text-7xl">
                    {card.amount}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/75">{card.caption}</p>
                </div>
              ) : null}
            </div>
          </motion.article>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path
        d="M6 13.5 L11 18.5 L20 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

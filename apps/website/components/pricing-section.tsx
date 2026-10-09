"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { householdFeatures, plans, type PlanKey } from "@/lib/site-content";
import { duration, easeOut, focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useReveal } from "@/hooks/use-reveal";
import { SectionLabel } from "@/components/section-label";
import { MagneticButton } from "@/components/magnetic-button";

export function PricingSection() {
  const ref = useReveal<HTMLElement>();
  const reduce = useReducedMotion();
  const [plan, setPlan] = useState<PlanKey>("monthly");
  const active = plans[plan];

  return (
    <section
      ref={ref}
      id="pricing"
      aria-labelledby="pricing-heading"
      className="site-wrap scroll-mt-24"
    >
      <div className="flex flex-col items-center text-center" data-reveal>
        <SectionLabel>Pricing</SectionLabel>
        <h2
          id="pricing-heading"
          className="mt-6 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl lg:text-display"
        >
          Go Unlimited!
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fog">
          One plan for the whole household. Free for 14 days. Cancel anytime.
        </p>

        <div
          className="mt-8 inline-flex rounded-full bg-ink-soft p-1"
          role="group"
          aria-label="Billing period"
        >
          {(Object.keys(plans) as PlanKey[]).map((key) => {
            const selected = plan === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => setPlan(key)}
                className={cn(
                  "relative rounded-full px-7 py-3 text-sm font-semibold sm:px-8",
                  focusRing,
                  selected ? "text-ink" : "text-white/75",
                )}
              >
                {selected ? (
                  <motion.span
                    layoutId={reduce ? undefined : "plan-pill"}
                    className="absolute inset-0 rounded-full bg-lilac"
                    transition={{ duration: duration.fast, ease: easeOut }}
                  />
                ) : null}
                <span className="relative">{plans[key].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-12 grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <article
          data-reveal
          className="rounded-card bg-ink-card px-6 py-8 sm:px-8"
        >
          <h3 className="text-xl font-semibold text-white">Features</h3>
          <p className="mt-2 text-sm leading-relaxed text-fog">
            Everything Unlimited includes for your household.
          </p>
          <ul className="mt-7 space-y-5">
            {householdFeatures.map((feature, index) => (
              <li key={feature} className="flex gap-4">
                <span className="relative mt-1 flex w-3 shrink-0 justify-center" aria-hidden="true">
                  {index < householdFeatures.length - 1 ? (
                    <span className="absolute top-3 bottom-[-1.4rem] w-px bg-lilac/40" />
                  ) : null}
                  <span className="relative size-3 rounded-full bg-lilac" />
                </span>
                <span className="text-[15px] leading-snug font-medium text-white">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <div data-reveal className="flex flex-col lg:pt-2">
          <p className="text-sm leading-relaxed font-medium text-lilac">
            Your subscription. You&apos;re in control.
          </p>
          <div className="mt-5 flex items-center justify-between gap-4 rounded-[1.25rem] bg-ink-card px-6 py-5">
            <div>
              <p className="text-lg font-semibold text-white">{active.period}</p>
              <p className="text-sm text-fog">{active.billing}</p>
            </div>
            <p className="text-4xl font-bold tracking-[-0.03em] text-white">
              {active.price}
            </p>
          </div>
          <MagneticButton href="/create-account" className="mt-5 w-full">
            Upgrade to Premium
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

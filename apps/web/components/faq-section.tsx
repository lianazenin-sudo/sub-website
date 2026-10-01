"use client";

import { memo, useCallback, useState } from "react";
import Image from "next/image";
import { faqs } from "@/lib/site-content";
import { focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useReveal } from "@/hooks/use-reveal";
import { SectionLabel } from "@/components/section-label";

const faqItems = faqs.map((item) => ({
  ...item,
  id: item.q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, ""),
}));

export function FaqSection() {
  const ref = useReveal<HTMLElement>();
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);
  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <section
      ref={ref}
      id="faq"
      aria-labelledby="faq-heading"
      className="site-wrap scroll-mt-24 py-16 md:py-24"
    >
      <div className="mx-auto max-w-3xl text-center" data-reveal>
        <h2
          id="faq-heading"
          className="text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl lg:text-display"
        >
          Subscription control
          <span className="mt-1 flex items-center justify-center gap-3">
            for
            <Image
              src="/assets/mascot-head.png"
              alt=""
              width={122}
              height={81}
              className="inline-block h-10 w-auto sm:h-12"
            />
            everyone
          </span>
        </h2>
        <div className="mt-6">
          <SectionLabel>FAQs</SectionLabel>
        </div>
      </div>

      <ul className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 [overflow-anchor:none]">
        {faqItems.map((item) => (
          <FaqItem
            key={item.id}
            id={item.id}
            question={item.q}
            answer={item.a}
            expanded={openId === item.id}
            onToggle={toggle}
          />
        ))}
      </ul>
    </section>
  );
}

type FaqItemProps = {
  id: string;
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: (id: string) => void;
};

const FaqItem = memo(function FaqItem({ id, question, answer, expanded, onToggle }: FaqItemProps) {
  const panelId = `faq-panel-${id}`;
  const buttonId = `faq-button-${id}`;

  return (
    <li data-reveal>
      <article className="rounded-[1.25rem] bg-ink-card">
        <h3>
          <button
            id={buttonId}
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => onToggle(id)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5 sm:py-4",
              focusRing,
            )}
          >
            <Image
              src="/assets/mascot-head.png"
              alt=""
              width={122}
              height={81}
              className="h-8 w-auto shrink-0"
            />
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-white sm:text-base">
              {question}
            </span>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full bg-lilac/20 p-0 leading-none"
              aria-hidden="true"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className={cn(
                  "block origin-center text-lilac transition-[rotate] duration-[250ms] ease-[ease] motion-reduce:transition-none",
                  expanded && "rotate-45",
                )}
              >
                <path
                  d="M8 2.75 V13.25 M2.75 8 H13.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
        </h3>
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          inert={expanded ? undefined : true}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-[ease] motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="px-5 pb-5 pl-[4.25rem] text-sm leading-relaxed text-fog sm:pl-[4.75rem]">
              {answer}
            </p>
          </div>
        </div>
      </article>
    </li>
  );
});

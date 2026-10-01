"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Navbar } from "@/components/navbar";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";
import { policyIntro, policySections, policyUpdated } from "@/lib/privacy-policy";
import { useLenis } from "@/hooks/use-lenis";
import { cn } from "@/lib/utils";
import { focusRing } from "@/lib/motion";

export function PrivacyPolicyPage() {
  return (
    <SmoothScroll>
      <div className="min-h-dvh bg-ink text-white selection:bg-lilac selection:text-ink">
        <Navbar />
        <main>
          <article className="site-wrap pt-12 pb-8 md:pt-16">
            <header>
              <h1 className="text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
                Privacy Policy
              </h1>
              <p className="mt-3 text-sm font-medium text-lilac">
                Last updated {policyUpdated}
              </p>
              <p className="mt-5 text-[15px] leading-relaxed text-fog">
                {policyIntro}
              </p>
            </header>

            <div className="mt-10 grid items-start gap-8 lg:mt-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
              <Contents />
              <div className="min-w-0 space-y-12">
                {policySections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-[100px]"
                  >
                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-lilac sm:text-2xl">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-fog">
                      {section.blocks.map((block, index) =>
                        block.type === "p" ? (
                          <p key={index}>{block.text}</p>
                        ) : (
                          <ul key={index} className="list-disc space-y-2 pl-5 marker:text-lilac">
                            {block.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </article>
          <CtaSection />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}

function Contents() {
  const lenis = useLenis();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(policySections[0].id);

  useEffect(() => {
    const nodes = policySections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    if (!nodes.length) return;

    const headings = nodes
      .map((node) => node.querySelector("h2"))
      .filter((node): node is HTMLHeadingElement => node instanceof HTMLHeadingElement);

    // Watch the headings, not the whole sections. A long section stays
    // inside a top band after its heading has scrolled away, which would
    // keep the previous link highlighted.
    const visibleTops = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.closest("section")?.id;
          if (!id) continue;
          if (entry.isIntersecting) visibleTops.set(id, entry.boundingClientRect.top);
          else visibleTops.delete(id);
        }
        const next = [...visibleTops.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
        if (next) setActive(next);
      },
      { rootMargin: "-100px 0px -55% 0px", threshold: [0, 1] },
    );

    headings.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setActive(id);
    setOpen(false);
    // The mobile list collapses above the sections. Wait until that
    // height is gone, or the heading lands under the header.
    window.setTimeout(() => {
      const next = document.getElementById(id);
      if (!next) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (lenis && !reduce) {
        lenis.scrollTo(next, { offset: -100 });
      } else {
        next.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    }, 0);
  };

  return (
    <aside className="lg:sticky lg:top-[100px] lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto">
      <div className="rounded-2xl bg-ink-soft p-4 sm:p-5">
        <div className="hidden items-center gap-3 lg:flex">
          <Image
            src="/assets/mascot-head.png"
            alt=""
            width={122}
            height={81}
            className="h-7 w-auto"
          />
          <p className="text-sm font-semibold text-white">Contents</p>
        </div>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 text-left lg:hidden",
            focusRing,
          )}
          aria-expanded={open}
          aria-controls="policy-contents"
          onClick={() => setOpen((value) => !value)}
        >
          <Image
            src="/assets/mascot-head.png"
            alt=""
            width={122}
            height={81}
            className="h-7 w-auto"
          />
          <span className="text-sm font-semibold text-white">Contents</span>
          <Chevron open={open} />
        </button>
        <div className="my-3 h-px bg-white/10" aria-hidden="true" />
        <nav
          id="policy-contents"
          aria-label="On this page"
          className={cn("flex-col gap-1", open ? "flex" : "hidden lg:flex")}
        >
          {policySections.map((section) => {
            const selected = active === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={jump(section.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "relative rounded-lg py-2 pr-2 pl-4 text-sm transition-colors",
                  focusRing,
                  selected ? "font-medium text-lilac" : "text-fog hover:text-white",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-lilac transition-opacity",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />
                {section.title}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("ml-auto text-fog transition-transform", open && "rotate-180")}
    >
      <path
        d="M4 6 L8 10 L12 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

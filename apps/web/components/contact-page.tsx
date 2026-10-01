"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Navbar } from "@/components/navbar";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";
import { MagneticButton } from "@/components/magnetic-button";
import { ContactModal } from "@/components/contact-modal";
import { contactTopics } from "@/lib/contact-topics";
import { focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function ContactPage() {
  const [query, setQuery] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const emailUsRef = useRef<HTMLDivElement>(null);
  const closeContact = useCallback(() => {
    setContactOpen(false);
    window.setTimeout(() => {
      emailUsRef.current?.querySelector("button")?.focus();
    }, 0);
  }, []);
  const needle = query.trim().toLowerCase();
  const topics = useMemo(() => {
    if (!needle) return contactTopics;
    return contactTopics.filter((topic) => {
      const haystack = `${topic.title} ${topic.body}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [needle]);

  return (
    <SmoothScroll>
      <div className="min-h-dvh bg-ink text-white selection:bg-lilac selection:text-ink">
        <Navbar />
        <main>
          <section className="site-wrap pt-14 pb-6 md:pt-20">
            <h1 className="text-center text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              How can we{" "}
              <Image
                src="/assets/mascot-head.png"
                alt=""
                width={122}
                height={81}
                className="mx-1.5 inline-block h-9 w-auto align-middle sm:h-11"
              />{" "}
              help?
            </h1>

            <form
              role="search"
              className="mx-auto mt-8 max-w-xl"
              onSubmit={(event) => event.preventDefault()}
            >
              <label htmlFor="help-search" className="sr-only">
                Search help topics
              </label>
              <div className="flex h-12 items-center gap-3 rounded-full bg-ink-soft px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-lilac">
                <SearchIcon />
                <input
                  id="help-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-fog"
                />
              </div>
            </form>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3 lg:gap-5">
              {topics.map((topic) => (
                <article
                  key={topic.title}
                  className="relative flex min-h-[11.5rem] flex-col justify-between overflow-hidden rounded-card p-5 sm:min-h-[13.5rem] sm:p-6"
                >
                  {topic.tone === "gradient" ? (
                    <>
                      <div className="absolute inset-0 bg-[#816fca]" aria-hidden="true" />
                      <Image
                        src="/assets/topic-gradient.png"
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-ink-card" aria-hidden="true" />
                  )}
                  <h2 className="relative text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
                    {topic.title}
                  </h2>
                  <p
                    className={cn(
                      "relative mt-6 text-sm leading-relaxed",
                      topic.tone === "gradient" ? "text-white/80" : "text-fog",
                    )}
                  >
                    {topic.body}
                  </p>
                </article>
              ))}
            </div>
            {topics.length === 0 ? (
              <p className="mt-8 text-center text-sm text-fog" role="status">
                No topics match that search.
              </p>
            ) : null}

            <div className="mx-auto mt-16 max-w-3xl text-center md:mt-24">
              <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
                Still Need Help? Start A Chat.
              </h2>
              <div ref={emailUsRef} className="mt-8">
                <MagneticButton
                  type="button"
                  onClick={() => setContactOpen(true)}
                  className={cn("h-11 px-7 text-sm", focusRing)}
                >
                  Email us
                </MagneticButton>
              </div>
            </div>
          </section>
          <CtaSection />
        </main>
        <Footer />
        <ContactModal open={contactOpen} onClose={closeContact} />
      </div>
    </SmoothScroll>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0 text-fog">
      <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.2 12.2 L16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

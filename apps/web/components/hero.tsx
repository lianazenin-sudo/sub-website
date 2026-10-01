"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { gsap } from "@/lib/gsap";
import { duration, easeOut } from "@/lib/motion";
import { SplitText } from "@/components/split-text";
import { WaitlistForm } from "@/components/waitlist-form";

export function Hero() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const scrollLayer = scrollRef.current;
    const pointerLayer = pointerRef.current;
    if (!section || !scrollLayer || !pointerLayer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.to(scrollLayer, {
        yPercent: 14,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, section);

    const onMove = (event: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      gsap.to(pointerLayer, {
        x: px * 28,
        y: py * 18,
        duration: 0.9,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    section.addEventListener("mousemove", onMove);
    return () => {
      section.removeEventListener("mousemove", onMove);
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
        <div ref={scrollRef} className="mx-auto w-[min(1100px,130%)]">
          <div ref={pointerRef}>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: duration.slow, delay: 0.15, ease: easeOut }}
          >
            <Image
              src="/assets/hero-shapes.png"
              alt=""
              width={1024}
              height={420}
              priority
              className="h-auto w-full"
            />
          </motion.div>
          </div>
        </div>
      </div>

      <div className="site-wrap relative z-10 flex min-h-[28rem] flex-col items-center justify-center px-4 py-20 text-center sm:min-h-[32rem] md:py-28">
        <motion.p
          className="text-[12px] font-semibold tracking-[0.18em] text-white/70 uppercase"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, delay: 0.05, ease: easeOut }}
        >
          Household · Unlimited
        </motion.p>

        <h1
          id="hero-heading"
          className="mt-5 max-w-[16ch] text-[2.4rem] font-bold tracking-[-0.03em] text-white sm:text-5xl lg:text-hero"
        >
          <SplitText
            lines={[
              ["One", "home", "for", "all", "your"],
              ["subscriptions."],
            ]}
          />
        </h1>

        <motion.div
          className="mt-8 flex w-full justify-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, delay: 0.7, ease: easeOut }}
        >
          <WaitlistForm />
        </motion.div>
      </div>
    </section>
  );
}

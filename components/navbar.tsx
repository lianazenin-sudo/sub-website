"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { navLinks } from "@/lib/site-content";
import { duration, easeOut, focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useLenis } from "@/hooks/use-lenis";
import { MagneticButton } from "@/components/magnetic-button";

export function Navbar() {
  const reduce = useReducedMotion();
  const lenis = useLenis();
  const [open, setOpen] = useState(false);

  const go = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const hashAt = href.indexOf("#");
    if (hashAt === -1) return;
    const path = href.slice(0, hashAt);
    const hash = href.slice(hashAt);
    const here = window.location.pathname;
    const samePage = path === "" || path === here || (path === "/" && here === "/");
    if (!samePage) return;
    const target = document.querySelector(hash);
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    setOpen(false);
    if (lenis) {
      lenis.scrollTo(target, { offset: -24 });
    } else {
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }
  };

  return (
    <motion.header
      className="sticky top-0 z-40 bg-ink/90 backdrop-blur-md"
      initial={reduce ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: easeOut }}
    >
      <div className="site-wrap flex h-[4.75rem] items-center justify-between gap-4">
        <a
          href="/"
          onClick={(event) => {
            if (window.location.pathname !== "/") return;
            event.preventDefault();
            if (lenis) lenis.scrollTo(0);
            else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
          }}
          className={cn("inline-flex items-center gap-2.5", focusRing)}
        >
          <Image
            src="/assets/logo-mark.png"
            alt=""
            width={83}
            height={56}
            priority
            className="h-7 w-auto"
          />
          <span className="font-logo text-[1.65rem] leading-none tracking-wide text-white">
            TRACE
          </span>
        </a>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full bg-ink-soft px-2 py-1.5 lg:flex"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={go(link.href)}
              className={cn(
                "site-link rounded-full px-4 py-2 text-sm font-medium text-white/85",
                focusRing,
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <MagneticButton href="/onboarding" className="hidden h-11 px-6 text-sm sm:inline-flex">
            Download
          </MagneticButton>
          <button
            type="button"
            className={cn(
              "grid size-11 place-items-center rounded-full bg-ink-soft text-white lg:hidden",
              focusRing,
            )}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="site-wrap pb-5 lg:hidden">
          <div className="flex flex-col gap-1 rounded-card bg-ink-soft p-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={go(link.href)}
                className={cn(
                  "rounded-2xl px-4 py-3 text-base font-medium text-white",
                  focusRing,
                )}
              >
                {link.label}
              </a>
            ))}
            <MagneticButton href="/onboarding" className="mt-2 w-full sm:hidden">
              Download
            </MagneticButton>
          </div>
        </nav>
      ) : null}
    </motion.header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d={open ? "M4 4 L14 14 M14 4 L4 14" : "M3 5 H15 M3 9 H15 M3 13 H15"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { discordInviteUrl, navLinks } from "@/lib/site-content";
import { duration, easeOut, focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useLenis } from "@/hooks/use-lenis";
import { MagneticButton } from "@/components/magnetic-button";

export function Navbar() {
  const reduce = useReducedMotion();
  const lenis = useLenis();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    const menuWasOpen = open;
    setOpen(false);
    const scroll = () => {
      if (lenis && !menuWasOpen) {
        lenis.scrollTo(target, { offset: -24 });
        return;
      }
      lenis?.start();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      const top = target.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    };
    if (menuWasOpen) window.setTimeout(scroll, 50);
    else scroll();
  };

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    lenis?.stop();
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);

    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
      lenis?.start();
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open, lenis]);

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
          <MagneticButton
            href={discordInviteUrl}
            external
            className="hidden h-11 px-6 text-sm sm:inline-flex"
          >
            Join Discord
          </MagneticButton>
          <button
            ref={menuButtonRef}
            type="button"
            className={cn(
              "grid size-11 place-items-center rounded-full bg-ink-soft text-white lg:hidden",
              focusRing,
            )}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-hidden={open}
            tabIndex={open ? -1 : 0}
            onClick={() => setOpen(true)}
          >
            <span className="sr-only">Open menu</span>
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {open
        ? createPortal(
            <motion.div
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-0 z-[9999] flex flex-col bg-black/85 backdrop-blur-[12px] lg:hidden"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              <div className="site-wrap flex h-[4.75rem] items-center justify-end">
                <button
                  ref={closeRef}
                  type="button"
                  className={cn(
                    "grid size-12 place-items-center rounded-full text-white transition-colors duration-200 hover:bg-white/10",
                    focusRing,
                  )}
                  onClick={() => setOpen(false)}
                >
                  <span className="sr-only">Close menu</span>
                  <MenuIcon open />
                </button>
              </div>
              <nav
                aria-label="Mobile"
                className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-16"
              >
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={go(link.href)}
                    className={cn(
                      "site-link min-h-12 px-4 py-3 text-center text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-white/90 transition-colors duration-200 hover:text-white",
                      focusRing,
                    )}
                  >
                    {link.label}
                  </a>
                ))}
                <MagneticButton
                  href={discordInviteUrl}
                  external
                  onClick={() => setOpen(false)}
                  className="mt-4 h-12 px-10 text-[15px]"
                >
                  Join Discord
                </MagneticButton>
              </nav>
            </motion.div>,
            document.body,
          )
        : null}
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

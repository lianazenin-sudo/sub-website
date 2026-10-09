"use client";

import { useState } from "react";
import { footerColumns } from "@/lib/site-content";
import { focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useLenis } from "@/hooks/use-lenis";

export function Footer() {
  const lenis = useLenis();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

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
    if (lenis) lenis.scrollTo(target, { offset: -24 });
    else target.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer id="contact" className="relative overflow-hidden pt-14 pb-24 md:pt-20 md:pb-28">
      <div className="site-wrap relative z-10 grid gap-12 pb-10 md:grid-cols-[1fr_1.1fr] md:items-start">
        <div className="grid grid-cols-2 gap-8">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold text-white">{column.title}</h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={go(link.href)}
                      className={cn("site-link text-sm text-fog", focusRing)}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <form
          className="md:justify-self-end md:max-w-md md:w-full"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.trim()) return;
            setDone(true);
          }}
        >
          <label htmlFor="footer-email" className="text-sm font-semibold text-white">
            Stay in the loop
          </label>
          <div className="relative mt-3">
            <input
              id="footer-email"
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setDone(false);
              }}
              placeholder="Email address"
              autoComplete="email"
              className={cn(
                "h-14 w-full rounded-full bg-ink-soft pr-32 pl-5 text-sm text-white placeholder:text-fog",
                focusRing,
              )}
            />
            <button
              type="submit"
              className={cn(
                "absolute top-1.5 right-1.5 h-11 rounded-full bg-lilac px-5 text-sm font-semibold text-ink",
                focusRing,
              )}
            >
              Sign up
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fog" role="status">
            {done
              ? "You're on the list. We'll write when there's something worth opening."
              : "Product notes only. Unsubscribe whenever you want."}
          </p>
        </form>
      </div>

      <p className="relative z-10 pt-10 text-center text-xs text-fog">© 2026 Trace</p>

      <p
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 z-0 -translate-x-1/2 translate-y-[88%] font-logo text-[34vw] leading-[0.8] whitespace-nowrap text-[#242424] select-none"
      >
        TRACE
      </p>
    </footer>
  );
}

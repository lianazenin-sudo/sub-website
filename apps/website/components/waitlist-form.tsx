"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { isValidEmail } from "@/lib/auth/email";
import { cn } from "@/lib/utils";
import { focusRing } from "@/lib/motion";

type Phase = "idle" | "loading" | "success" | "error";

type WaitlistFormProps = {
  className?: string;
  source?: string;
};

export function WaitlistForm({ className, source = "landing-waitlist" }: WaitlistFormProps) {
  const messageId = useId();
  const submitting = useRef(false);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || phase === "success") return;

    const website = String(new FormData(event.currentTarget).get("website") ?? "");
    const value = email.trim();

    if (!value) {
      setPhase("idle");
      setMessage("Enter your email address");
      return;
    }

    if (!isValidEmail(value)) {
      setPhase("idle");
      setMessage("Enter a valid email address");
      return;
    }

    submitting.current = true;
    setPhase("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source, website }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        setPhase("error");
        setMessage(result.error || "Something went wrong, please try again");
        return;
      }

      setEmail("");
      setPhase("success");
    } catch {
      setPhase("error");
      setMessage("Something went wrong, please try again");
    } finally {
      submitting.current = false;
    }
  }

  if (phase === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex w-[min(100%,28rem)] items-center gap-3 rounded-[1.75rem] bg-ink-card px-3 py-2.5 text-left sm:gap-4 sm:px-4 sm:py-3",
          className,
        )}
      >
        <Image
          src="/assets/waitlist-mascot.png"
          alt=""
          width={62}
          height={54}
          className="h-14 w-auto shrink-0"
        />
        <p className="text-sm font-semibold leading-snug tracking-[-0.02em] text-white sm:text-[15px]">
          Congratulations! You have joined the squad
        </p>
      </div>
    );
  }

  const busy = phase === "loading";

  return (
    <>
    <style>{`
      .waitlist-email:-webkit-autofill,
      .waitlist-email:-webkit-autofill:hover,
      .waitlist-email:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px var(--color-waitlist) inset;
        -webkit-text-fill-color: var(--color-waitlist-ink);
        caret-color: var(--color-waitlist-ink);
        transition: background-color 9999s ease-in-out 0s;
      }
    `}</style>
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn("relative w-[min(100%,26rem)]", className)}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-waitlist py-1.5 pr-1.5 pl-3.5",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white",
          "sm:py-2 sm:pr-2 sm:pl-5",
        )}
      >
        <label htmlFor={`${messageId}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${messageId}-email`}
          type="email"
          name="email"
          required
          value={email}
          disabled={busy}
          autoComplete="email"
          inputMode="email"
          placeholder="example@gmail.com"
          aria-label="Email address"
          aria-invalid={Boolean(message)}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            if (!busy) {
              setPhase("idle");
              setMessage("");
            }
          }}
          className="waitlist-email min-w-0 flex-1 border-none bg-transparent text-[13px] text-waitlist-ink shadow-none outline-none placeholder:text-waitlist-ink/55 caret-waitlist-ink selection:bg-waitlist-ink/15 selection:text-waitlist-ink disabled:opacity-60 sm:text-sm"
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          defaultValue=""
          className="sr-only"
        />
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "shrink-0 rounded-full bg-waitlist-ink px-3.5 py-2 text-[13px] font-medium text-white",
            "disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:py-2.5 sm:text-sm",
            focusRing,
          )}
        >
          {busy ? "Joining..." : "Join Wait list"}
        </button>
      </div>
      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className={cn("mt-2 text-center text-[13px] text-white", !message && "sr-only")}
      >
        {message}
      </p>
    </form>
    </>
  );
}

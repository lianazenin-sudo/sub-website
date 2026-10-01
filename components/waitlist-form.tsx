"use client";

import { useId, useState } from "react";
import { isValidEmail } from "@/lib/auth/email";
import { cn } from "@/lib/utils";
import { focusRing } from "@/lib/motion";

type Phase = "idle" | "loading" | "success" | "error";

type WaitlistFormProps = {
  className?: string;
};

export function WaitlistForm({ className }: WaitlistFormProps) {
  const messageId = useId();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "loading" || phase === "success") return;

    const website = String(new FormData(event.currentTarget).get("website") ?? "");
    const value = email.trim();

    if (!isValidEmail(value)) {
      setPhase("idle");
      setMessage("Enter a valid email address");
      return;
    }

    setPhase("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, website }),
      });
      const result = (await response.json()) as { ok?: boolean };

      if (!response.ok || !result.ok) {
        setPhase("error");
        setMessage("Something went wrong, please try again");
        return;
      }

      setEmail("");
      setPhase("success");
    } catch {
      setPhase("error");
      setMessage("Something went wrong, please try again");
    }
  }

  if (phase === "success") {
    return (
      <p role="status" aria-live="polite" className="text-sm font-medium text-white sm:text-base">
        You&apos;re on the list! 🎉
      </p>
    );
  }

  const busy = phase === "loading";

  return (
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
          className="min-w-0 flex-1 bg-transparent text-[13px] text-waitlist-ink outline-none placeholder:text-waitlist-ink/55 disabled:opacity-60 sm:text-sm"
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
  );
}

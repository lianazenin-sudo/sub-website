"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { isValidEmail } from "@/lib/auth/email";
import { contactSubjects, type ContactSubject } from "@/lib/contact-form";
import { useLenis } from "@/hooks/use-lenis";
import { easeOut, focusRing } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ContactModalProps = {
  open: boolean;
  onClose: () => void;
};

type FieldErrors = Partial<Record<"name" | "email" | "subject" | "message", string>>;

const fieldClass =
  "w-full rounded-xl bg-[#222] px-4 py-3 text-sm text-white outline-none transition-shadow duration-200 placeholder:text-fog focus:ring-2 focus:ring-waitlist disabled:opacity-60";

export function ContactModal({ open, onClose }: ContactModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? <ContactDialog onClose={onClose} /> : null}
    </AnimatePresence>,
    document.body,
  );
}

function ContactDialog({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const lenis = useLenis();
  const titleId = useId();
  const statusId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<"" | ContactSubject>("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([aria-hidden="true"]), select:not([disabled])',
      )].filter((node) => node.tabIndex !== -1);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      lenis?.start();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lenis, onClose]);

  function validate() {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    if (!subject) next.subject = "Choose a subject.";
    if (message.trim().length < 10) next.message = "Message must be at least 10 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "loading") return;
    const website = String(new FormData(event.currentTarget).get("website") ?? "");
    if (!validate()) return;

    setPhase("loading");
    setStatus("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
          website,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setPhase("error");
        setStatus(result.error || "Something went wrong, please try again");
        return;
      }
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setErrors({});
      setPhase("success");
      setStatus("");
    } catch {
      setPhase("error");
      setStatus("Something went wrong, please try again");
    }
  }

  const busy = phase === "loading";

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[6px]"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ duration: 0.22, ease: easeOut }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[20px] bg-ink-soft p-6 sm:p-8"
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.24, ease: easeOut }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.02em] text-white">
              Get in touch
            </h2>
            <p className="mt-1.5 text-sm text-fog">
              Send us a message and we&apos;ll get back to you soon.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-fog transition-colors hover:text-white",
              focusRing,
            )}
          >
            <CloseIcon />
          </button>
        </div>

        {phase === "success" ? (
          <div className="mt-8">
            <p aria-live="polite" className="text-sm leading-relaxed text-white">
              Thanks! Your message has been sent. We&apos;ll reply soon.
            </p>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "mt-6 h-12 w-full rounded-full bg-waitlist text-sm font-medium text-waitlist-ink",
                "transition duration-200 hover:-translate-y-px hover:brightness-110",
                focusRing,
              )}
            >
              Close
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <Field label="Name" htmlFor="contact-name" error={errors.name}>
              <input
                ref={nameRef}
                id="contact-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                disabled={busy}
                value={name}
                placeholder="Your name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "contact-name-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((current) => ({ ...current, name: undefined }));
                }}
                className={fieldClass}
              />
            </Field>

            <Field label="Email" htmlFor="contact-email" error={errors.email}>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={busy}
                value={email}
                placeholder="you@email.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((current) => ({ ...current, email: undefined }));
                }}
                className={fieldClass}
              />
            </Field>

            <Field label="Subject" htmlFor="contact-subject" error={errors.subject}>
              <select
                id="contact-subject"
                name="subject"
                required
                disabled={busy}
                value={subject}
                aria-invalid={Boolean(errors.subject)}
                aria-describedby={errors.subject ? "contact-subject-error" : undefined}
                onChange={(event) => {
                  setSubject(event.target.value as ContactSubject | "");
                  setErrors((current) => ({ ...current, subject: undefined }));
                }}
                className={cn(fieldClass, "appearance-none", !subject && "text-fog")}
              >
                <option value="" disabled>
                  Select a subject
                </option>
                {contactSubjects.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Message" htmlFor="contact-message" error={errors.message}>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                disabled={busy}
                value={message}
                placeholder="How can we help?"
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "contact-message-error" : undefined}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setErrors((current) => ({ ...current, message: undefined }));
                }}
                className={cn(fieldClass, "resize-y")}
              />
            </Field>

            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              defaultValue=""
              className="sr-only"
            />

            <p id={statusId} role="status" aria-live="polite" className={cn("text-sm text-white", !status && "sr-only")}>
              {status}
            </p>

            <button
              type="submit"
              disabled={busy}
              className={cn(
                "h-12 w-full rounded-full bg-waitlist text-sm font-medium text-waitlist-ink",
                "transition duration-200 hover:-translate-y-px hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:brightness-100",
                focusRing,
              )}
            >
              {busy ? "Sending..." : "Send message"}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-white">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-[#f0a8a8]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 4 L12 12 M12 4 L4 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

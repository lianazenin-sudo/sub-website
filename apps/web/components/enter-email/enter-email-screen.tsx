"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { StepProgress } from "@/components/ui/step-progress";
import { isValidEmail } from "@/lib/auth/email";
import { cn } from "@/lib/utils";

export function EnterEmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const showInvalidError = touched && trimmedEmail.length > 0 && !isValidEmail(trimmedEmail);
  const canContinue = isValidEmail(trimmedEmail) && !isSubmitting;

  const inputBorderClass = useMemo(() => {
    if (showInvalidError) return "border-[#C30407]";
    return "border-[#646464]";
  }, [showInvalidError]);

  async function handleSubmit() {
    if (!canContinue) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (!response.ok) {
        throw new Error("Unable to save email");
      }

      router.push("/create-username");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="animate-slide-in-right flex min-h-dvh w-full flex-col bg-[#111111] px-8 pt-10 pb-8">
      <header className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={() => router.push("/create-account")}
          aria-label="Go back"
          className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-[#323232] text-white transition-opacity hover:opacity-90"
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </button>
        <StepProgress currentStep={2} totalSteps={3} />
      </header>

      <div className="mt-16 flex flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-sans text-[28px] font-bold leading-tight text-white">
            Enter your email
          </h1>
          <p className="mt-3 max-w-[17rem] font-sans text-[12px] leading-relaxed text-[#888888]">
            We&apos;ll send a verification code to confirm it&apos;s you.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-sm">
          <label
            htmlFor="email"
            className="mb-2 block font-sans text-sm text-white"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSubmitError(null);
            }}
            onBlur={() => setTouched(true)}
            aria-invalid={showInvalidError}
            aria-describedby={showInvalidError ? "email-error" : undefined}
            className={cn(
              "h-14 w-full rounded-[12px] border bg-[#1F1F1F] px-4 font-sans text-base text-white outline-none transition-colors",
              inputBorderClass,
            )}
          />
          {showInvalidError && (
            <p
              id="email-error"
              className="mt-2 font-sans text-[12px] text-[#C30407]"
            >
              Enter a valid email address
            </p>
          )}
          {submitError && (
            <p className="mt-2 font-sans text-[12px] text-[#C30407]">
              {submitError}
            </p>
          )}
        </div>

        <div className="mt-auto flex w-full max-w-sm flex-col items-center gap-4 self-center pt-8">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canContinue}
            className={cn(
              "flex h-[60px] w-full items-center justify-center gap-2 rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black transition-opacity",
              canContinue
                ? "hover:opacity-90 active:opacity-80"
                : "cursor-not-allowed opacity-40",
            )}
          >
            {isSubmitting && <Loader2 className="size-5 animate-spin" />}
            Next
          </button>
          <Link
            href="/create-username"
            className="font-sans text-sm text-[#888888] transition-opacity hover:opacity-80"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </main>
  );
}

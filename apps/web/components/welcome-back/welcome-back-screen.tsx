"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useGoogleSignIn } from "@/hooks/use-google-sign-in";
import { isValidEmail } from "@/lib/auth/email";
import { cn } from "@/lib/utils";
import { ROUTES } from "@trace/shared";

export function WelcomeBackScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const showEmailError =
    emailTouched && trimmedEmail.length > 0 && !isValidEmail(trimmedEmail);
  const canSubmit =
    isValidEmail(trimmedEmail) && password.length > 0 && !isSubmitting;

  const { signIn, isLoading: isGoogleLoading } = useGoogleSignIn({
    onSuccess: () => {
      setErrorMessage(null);
      // Member home screen is not designed yet — session is saved.
    },
    onError: (message) => {
      setErrorMessage(message);
    },
  });

  const emailBorderClass = useMemo(() => {
    if (showEmailError) return "border-[#C30407]";
    return "border-[#646464]";
  }, [showEmailError]);

  async function handleNext() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (!response.ok) {
        throw new Error("Unable to sign in");
      }

      // Member home screen is not designed yet — session is saved.
    } catch {
      setErrorMessage("Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy = isGoogleLoading || isSubmitting;

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#111111] px-8 pt-10 pb-8">
      <header className="relative flex items-center">
        <button
          type="button"
          onClick={() => router.push(ROUTES.onboarding)}
          aria-label="Go back"
          className="flex size-12 items-center justify-center rounded-full bg-[#323232] text-white transition-opacity hover:opacity-90"
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </button>
      </header>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/brand/welcome-mascot.png"
            alt=""
            width={120}
            height={105}
            priority
            className="h-auto w-[7.5rem] select-none"
            aria-hidden
          />
          <h1 className="mt-6 font-sans text-[28px] font-bold leading-tight text-white">
            Welcome Back!
          </h1>
          <p className="mt-3 max-w-[16rem] font-sans text-[12px] leading-relaxed text-[#888888]">
            Sign in with your email to pick up where you left off
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-sm space-y-5">
          <div>
            <label
              htmlFor="welcome-email"
              className="mb-2 block font-sans text-sm text-white"
            >
              Email
            </label>
            <input
              id="welcome-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage(null);
              }}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={showEmailError}
              disabled={busy}
              className={cn(
                "h-14 w-full rounded-[12px] border bg-transparent px-4 font-sans text-base text-white outline-none transition-colors",
                emailBorderClass,
              )}
            />
            {showEmailError && (
              <p className="mt-2 font-sans text-[12px] text-[#C30407]">
                Enter a valid email address
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="welcome-password"
              className="mb-2 block font-sans text-sm text-white"
            >
              Password
            </label>
            <input
              id="welcome-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrorMessage(null);
              }}
              disabled={busy}
              className="h-14 w-full rounded-[12px] border border-[#646464] bg-transparent px-4 font-sans text-base text-white outline-none transition-colors"
            />
          </div>
        </div>

        <div className="mt-auto flex w-full max-w-sm flex-col items-center gap-4 self-center pt-8">
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              signIn();
            }}
            disabled={busy}
            className={cn(
              "flex h-[60px] w-full items-center justify-center gap-2 rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black transition-opacity",
              busy
                ? "cursor-not-allowed opacity-70"
                : "hover:opacity-90 active:opacity-80",
            )}
          >
            {isGoogleLoading && (
              <Loader2 className="size-5 animate-spin" aria-label="Signing in" />
            )}
            Connect with Google
          </button>

          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canSubmit || busy}
            className={cn(
              "flex h-[60px] w-full items-center justify-center gap-2 rounded-full bg-[#323232] font-sans text-[14px] font-semibold text-white transition-opacity",
              canSubmit && !busy
                ? "hover:opacity-90 active:opacity-80"
                : "cursor-not-allowed opacity-40",
            )}
          >
            {isSubmitting && <Loader2 className="size-5 animate-spin" />}
            Next
          </button>

          {errorMessage && (
            <p className="text-center font-sans text-[12px] text-[#C30407]">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

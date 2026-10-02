"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { StepProgress } from "@/components/ui/step-progress";
import { useGoogleSignIn } from "@/hooks/use-google-sign-in";
import { cn } from "@/lib/utils";
import {
  CREATE_ACCOUNT_FEATURES as FEATURES,
  ROUTES,
} from "@trace/shared";

export function CreateAccountScreen() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { signIn, isLoading } = useGoogleSignIn({
    onSuccess: () => {
      setErrorMessage(null);
      router.push(ROUTES.createUsername);
    },
    onError: (message) => {
      setErrorMessage(message);
    },
  });

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#111111] px-8 pt-10 pb-8">
      <header className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={() => router.push(ROUTES.onboarding)}
          aria-label="Go back"
          className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-[#323232] text-white transition-opacity hover:opacity-90"
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </button>
        <StepProgress currentStep={1} totalSteps={3} />
      </header>

      <div className="mt-8 flex flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/brand/trace-mark-purple.png"
            alt=""
            width={116}
            height={80}
            priority
            className="h-auto w-[7.25rem] select-none"
            aria-hidden
          />
          <h1 className="mt-5 font-sans text-[28px] font-bold leading-tight text-white">
            Create Account
          </h1>
          <p className="mt-3 max-w-[16rem] font-sans text-sm leading-relaxed text-[#888888]">
            Let Trace find the subscriptions you already pay for.
          </p>
        </div>

        <ul className="mx-auto mt-10 flex w-full max-w-sm flex-col">
          {FEATURES.map((feature, index) => {
            const isLast = index === FEATURES.length - 1;

            return (
              <li key={feature} className="flex gap-3">
                <div className="relative flex w-4 shrink-0 flex-col items-center self-stretch">
                  <span
                    className="relative z-10 size-4 shrink-0 rounded-full bg-[#A4A1FF]"
                    aria-hidden
                  />
                  {!isLast && (
                    <span
                      className="absolute top-2 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-[#A4A1FF]"
                      aria-hidden
                    />
                  )}
                </div>
                <p
                  className={cn(
                    "font-sans text-[12px] leading-snug text-white",
                    !isLast && "pb-5",
                  )}
                >
                  {feature}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto flex w-full max-w-sm flex-col items-center gap-4 self-center pt-8">
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              signIn();
            }}
            disabled={isLoading}
            className={cn(
              "flex h-[60px] w-full items-center justify-center rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black transition-opacity",
              isLoading
                ? "cursor-not-allowed opacity-70"
                : "hover:opacity-90 active:opacity-80",
            )}
          >
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" aria-label="Signing in" />
            ) : (
              "Continue with Google"
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              router.push(ROUTES.enterEmail);
            }}
            className="flex h-[60px] w-full items-center justify-center rounded-full border border-[#4A4A4A] bg-[#323232] font-sans text-[14px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            Continue with Email
          </button>

          {errorMessage && (
            <p className="text-center font-sans text-[12px] text-[#C30407]">
              {errorMessage}
            </p>
          )}

          <p className="mt-1 max-w-[18rem] text-center font-sans text-xs leading-relaxed text-[#888888]">
            You can disconnect your account and remove Trace&apos;s access at
            any time.
          </p>
        </div>
      </div>
    </main>
  );
}

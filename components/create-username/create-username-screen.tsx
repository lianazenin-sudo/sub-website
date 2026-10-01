"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronLeft, Loader2 } from "lucide-react";
import { StepProgress } from "@/components/ui/step-progress";
import { useUsernameAvailability } from "@/hooks/use-username-availability";
import { sanitizeUsernameInput } from "@/lib/username";
import { cn } from "@/lib/utils";

export function CreateUsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const status = useUsernameAvailability(username);

  const canContinue = status === "available";

  async function handleNext() {
    if (!canContinue || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error("Unable to save username");
      }

      router.push("/scanning");
    } catch {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#111111] px-8 pt-10 pb-8">
      <header className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-[#323232] text-white transition-opacity hover:opacity-90"
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </button>
        <StepProgress currentStep={3} totalSteps={3} />
      </header>

      <div className="mt-16 flex flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-sans text-[28px] font-bold leading-tight text-white">
            Create Username
          </h1>
          <p className="mt-3 max-w-[17rem] font-sans text-[12px] leading-relaxed text-[#888888]">
            Personalize your account with unique name. Username can be changed.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-sm">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(sanitizeUsernameInput(event.target.value))
              }
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={status === "taken"}
              aria-describedby={
                status === "available" || status === "taken"
                  ? "username-status"
                  : undefined
              }
              className={cn(
                "h-14 w-full rounded-[12px] border bg-transparent px-4 pr-12 font-sans text-base text-white outline-none transition-colors placeholder:text-[#666666]",
                status === "available" && "border-[#81B751]",
                status === "taken" && "border-[#C30407]",
                status !== "available" &&
                  status !== "taken" &&
                  "border-[#646464]",
              )}
            />

            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
              {status === "loading" && (
                <Loader2
                  className="size-5 animate-spin text-[#A4A1FF]"
                  aria-label="Checking username"
                />
              )}
              {status === "available" && (
                <span className="flex size-5 items-center justify-center rounded-full bg-[#81B751]">
                  <Check className="size-3 text-white" strokeWidth={3} />
                </span>
              )}
              {status === "taken" && (
                <span className="flex size-5 items-center justify-center rounded-full bg-[#C30407]">
                  <AlertCircle
                    className="size-3.5 text-white"
                    strokeWidth={2.5}
                  />
                </span>
              )}
            </div>
          </div>

          {status === "available" && (
            <p
              id="username-status"
              className="mt-2 font-sans text-[12px] text-[#81B751]"
            >
              Username is available
            </p>
          )}
          {status === "taken" && (
            <p
              id="username-status"
              className="mt-2 font-sans text-[12px] text-[#C30407]"
            >
              Username is already taken
            </p>
          )}
        </div>

        <div className="mt-auto flex w-full max-w-sm flex-col items-center gap-4 self-center pt-8">
          <button
            type="button"
            disabled={!canContinue || isSaving}
            onClick={() => void handleNext()}
            className={cn(
              "flex h-[60px] w-full items-center justify-center gap-2 rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black transition-opacity",
              canContinue && !isSaving
                ? "hover:opacity-90 active:opacity-80"
                : "cursor-not-allowed opacity-40",
            )}
          >
            {isSaving && <Loader2 className="size-5 animate-spin" />}
            Next
          </button>
          <Link
            href="/scanning"
            className="font-sans text-sm text-[#888888] transition-opacity hover:opacity-80"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </main>
  );
}

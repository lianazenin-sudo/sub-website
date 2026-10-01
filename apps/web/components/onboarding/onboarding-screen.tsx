import Image from "next/image";
import Link from "next/link";
import { TraceLogo } from "@/components/brand/trace-logo";

export function OnboardingScreen() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center bg-[#111111] px-8 pt-16 pb-8">
      <TraceLogo size={24} />

      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 py-6">
        <Image
          src="/brand/onboarding-hero.png"
          alt=""
          width={255}
          height={284}
          priority
          className="h-auto w-[62%] max-w-[16rem] select-none"
          aria-hidden
        />

        <h1 className="max-w-[15rem] text-center font-sans text-2xl leading-snug font-bold text-white">
          One home for all your subscriptions.
        </h1>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <Link
          href="/create-account"
          className="flex h-[60px] w-full items-center justify-center rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black transition-opacity hover:opacity-90 active:opacity-80"
        >
          Create New Account
        </Link>
        <Link
          href="/welcome-back"
          className="flex h-[60px] w-full items-center justify-center rounded-full bg-[#323232] font-sans text-[14px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Already a member
        </Link>

        <p className="mt-2 max-w-[17rem] text-center font-sans text-xs leading-relaxed text-[#888888]">
          By continuing, you agree to our{" "}
          <Link href="#" className="text-[#A4A1FF]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-[#A4A1FF]">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const SPLASH_DURATION_MS = 4000;

export function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      router.push("/onboarding");
    }, SPLASH_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center overflow-hidden bg-[#111111]">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <h1 className="font-logo text-[50px] leading-none tracking-wide text-white">
          TRACE
        </h1>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <Image
          src="/brand/trace-mascot.png"
          alt=""
          width={274}
          height={182}
          priority
          className="h-auto w-[66.8%] max-w-[22rem] select-none"
          aria-hidden
        />
      </div>
    </main>
  );
}

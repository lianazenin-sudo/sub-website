import Image from "next/image";
import type { ReactNode } from "react";

const BASE = "/brand/scanning";

/**
 * Figma decoration layer for APP scanning screens (400×800 reference).
 * Coordinates measured from Frame 25 / Frame 27 exports — locked across steps.
 */
export function ScanningDecorations() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <Image
        src={`${BASE}/ellipse-lavender-large.png`}
        alt=""
        width={215}
        height={206}
        className="absolute top-0 left-0 h-[206px] w-[215px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/star-lavender.png`}
        alt=""
        width={46}
        height={45}
        className="absolute top-[6px] left-[355px] h-[38px] w-[41px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/star-yellow.png`}
        alt=""
        width={46}
        height={45}
        className="absolute top-[72px] left-[251px] h-[43px] w-[38px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/tennis-ball.png`}
        alt=""
        width={84}
        height={115}
        className="absolute top-[124px] left-[333px] h-[115px] w-[84px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/ellipse-blue.png`}
        alt=""
        width={42}
        height={42}
        className="absolute top-[530px] left-[332px] h-[42px] w-[42px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/ellipse-lavender-small.png`}
        alt=""
        width={42}
        height={42}
        className="absolute top-[613px] left-[124px] h-[42px] w-[42px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/basketball.png`}
        alt=""
        width={73}
        height={97}
        className="absolute top-[635px] left-0 h-[97px] w-[73px] max-w-none select-none"
        priority
      />

      <Image
        src={`${BASE}/star-yellow-burst.png`}
        alt=""
        width={242}
        height={228}
        className="absolute top-[573px] left-[159px] h-[228px] w-[242px] max-w-none select-none"
        priority
      />
    </div>
  );
}

/** Detective mascot — absolute so it never shifts between scanning steps. */
export function ScanningMascot() {
  return (
    <div
      className="pointer-events-none absolute top-[169px] left-1/2 z-10 -translate-x-1/2"
      aria-hidden
    >
      <Image
        src={`${BASE}/mascot.png`}
        alt=""
        width={134}
        height={118}
        priority
        className="h-[118px] w-[134px] select-none"
      />
    </div>
  );
}

/** Phone-width stage so Figma decorations align like the mobile frames. */
export function ScanningStage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full justify-center bg-[#111111]">
      <div className="relative h-dvh w-full max-w-[400px] overflow-hidden bg-[#111111]">
        <ScanningDecorations />
        <ScanningMascot />
        <div className="relative z-10 flex h-full flex-col">{children}</div>
      </div>
    </main>
  );
}

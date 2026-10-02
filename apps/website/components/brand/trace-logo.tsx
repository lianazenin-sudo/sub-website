import Image from "next/image";
import { cn } from "@/lib/utils";

type TraceLogoProps = {
  className?: string;
  /** Text size in pixels for the TRACE wordmark */
  size?: number;
};

export function TraceLogo({ className, size = 24 }: TraceLogoProps) {
  return (
    <div
      className={cn("inline-flex items-center", className)}
      style={{ fontSize: size, gap: `${size * 0.35}px` }}
    >
      <Image
        src="/brand/trace-mark-white.png"
        alt=""
        width={40}
        height={26}
        className="block h-[1.05em] w-auto shrink-0 select-none"
        aria-hidden
        priority
      />
      <span className="font-logo leading-none tracking-wide text-white">
        TRACE
      </span>
    </div>
  );
}

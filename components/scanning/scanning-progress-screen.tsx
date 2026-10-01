import Image from "next/image";
import { ScanningStage } from "@/components/scanning/scanning-decorations";
import { buildScanningChecklist } from "@/lib/scanning/steps";
import type { ScanningJob, ScanningStepVisualState } from "@/lib/scanning/types";
import { cn } from "@/lib/utils";

type ScanningProgressScreenProps = {
  username: string;
  job: ScanningJob;
};

function StepIcon({ state }: { state: ScanningStepVisualState }) {
  return (
    <Image
      src="/brand/scanning/checkmark.png"
      alt=""
      width={13}
      height={13}
      className={cn(
        "size-[13px] shrink-0 select-none",
        state === "pending" && "opacity-40",
      )}
      aria-hidden
    />
  );
}

export function ScanningProgressScreen({
  username,
  job,
}: ScanningProgressScreenProps) {
  const checklist = buildScanningChecklist(job);

  return (
    <ScanningStage>
      {/*
        Content locked to Frame 25 (400×800):
        title top ≈ 316px, checklist top ≈ 376px.
        Mascot lives in ScanningStage at top 169px.
      */}
      <div className="flex flex-1 flex-col items-center px-8 pt-[316px] pb-10">
        <h1 className="text-center font-sans text-[28px] font-bold leading-none tracking-[-0.02em] text-white">
          Hi! {username}
        </h1>
        <p className="mt-2 text-center font-sans text-[14px] font-medium leading-5 text-[#A4A1FF]">
          Finding your subscriptions...
        </p>

        <ul className="mt-3 flex w-[216px] flex-col gap-2">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <StepIcon state={item.state} />
              <span
                className={cn(
                  "font-sans text-[13px] leading-[13px] text-[#A4A1FF]",
                  item.state === "pending" && "opacity-40",
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ScanningStage>
  );
}

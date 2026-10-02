import { ScanningStage } from "@/components/scanning/scanning-decorations";

type ScanningCompleteScreenProps = {
  subscriptionsFound: number;
};

export function ScanningCompleteScreen({
  subscriptionsFound,
}: ScanningCompleteScreenProps) {
  return (
    <ScanningStage>
      {/*
        Same locked stage/mascot/decorations as progress (Frame 27).
        Title sits in the vertical center below the mascot.
      */}
      <div className="flex flex-1 flex-col items-center px-8 pt-[356px] pb-8">
        <h1 className="max-w-[15rem] text-center font-sans text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[#A4A1FF]">
          We found {subscriptionsFound}
          <br />
          subscriptions.
        </h1>
      </div>
    </ScanningStage>
  );
}

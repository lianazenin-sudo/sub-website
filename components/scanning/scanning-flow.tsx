"use client";

import { useState } from "react";
import { ScanningCompleteScreen } from "@/components/scanning/scanning-complete-screen";
import { ScanningProgressScreen } from "@/components/scanning/scanning-progress-screen";
import { useScanningJob } from "@/hooks/use-scanning-job";

type ScanningFlowProps = {
  username: string;
  initialJobId?: string | null;
};

export function ScanningFlow({ username, initialJobId }: ScanningFlowProps) {
  // Phase 1: stable fixture ids. GET /api/scanning/:id seeds the job.
  // Later phases create a real job via POST and pass that id here.
  const [jobId, setJobId] = useState<string>(
    initialJobId ?? "demo-progress",
  );
  const { job, error, refetch } = useScanningJob({ jobId });

  if (error) {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-black px-8 text-center">
        <p className="font-sans text-base text-[#A4A1FF]">
          Something went wrong while scanning your inbox.
        </p>
        <button
          type="button"
          className="mt-6 flex h-[60px] w-full max-w-sm items-center justify-center rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center bg-black">
        <p className="font-sans text-sm text-[#A4A1FF]">Starting scan...</p>
      </main>
    );
  }

  if (job.status === "failed") {
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-black px-8 text-center">
        <p className="font-sans text-base text-[#A4A1FF]">
          {job.error ?? "Something went wrong while scanning your inbox."}
        </p>
        <button
          type="button"
          className="mt-6 flex h-[60px] w-full max-w-sm items-center justify-center rounded-full bg-[#A4A1FF] font-sans text-[14px] font-semibold text-black"
          onClick={() => {
            setJobId(`demo-progress-${Date.now()}`);
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  if (job.status === "completed") {
    return (
      <ScanningCompleteScreen subscriptionsFound={job.subscriptionsFound} />
    );
  }

  return <ScanningProgressScreen username={username} job={job} />;
}

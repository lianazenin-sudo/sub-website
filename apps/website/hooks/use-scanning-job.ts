"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  scanningJobSchema,
  type ScanningJob,
} from "@/lib/scanning/types";

const DEFAULT_POLL_INTERVAL_MS = 1500;

type UseScanningJobOptions = {
  jobId: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
};

type UseScanningJobResult = {
  job: ScanningJob | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useScanningJob({
  jobId,
  enabled = true,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseScanningJobOptions): UseScanningJobResult {
  const [job, setJob] = useState<ScanningJob | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(jobId && enabled));
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<ScanningJob | null>(null);

  const refetch = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      jobRef.current = null;
      setIsLoading(false);
      return;
    }

    const response = await fetch(`/api/scanning/${jobId}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load scanning progress");
    }

    const data = scanningJobSchema.parse(await response.json());
    jobRef.current = data;
    setJob(data);
    setError(null);
    setIsLoading(false);
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        await refetch();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load scanning progress",
          );
          setIsLoading(false);
        }
        return;
      }

      if (cancelled) return;

      const current = jobRef.current;
      if (
        current &&
        current.status !== "completed" &&
        current.status !== "failed"
      ) {
        timeoutId = window.setTimeout(() => {
          void poll();
        }, pollIntervalMs);
      }
    };

    setIsLoading(true);
    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [jobId, enabled, pollIntervalMs, refetch]);

  return { job, isLoading, error, refetch };
}

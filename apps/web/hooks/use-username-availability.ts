"use client";

import { useEffect, useState } from "react";
import {
  checkUsernameAvailability,
  isUsernameFormatValid,
  normalizeUsername,
  type UsernameAvailability,
} from "@/lib/username";

const DEBOUNCE_MS = 500;

export type UsernameCheckStatus =
  | "idle"
  | "loading"
  | "available"
  | "taken";

export function useUsernameAvailability(rawValue: string): UsernameCheckStatus {
  const [status, setStatus] = useState<UsernameCheckStatus>("idle");

  useEffect(() => {
    const username = normalizeUsername(rawValue);

    if (!username) {
      setStatus("idle");
      return;
    }

    if (!isUsernameFormatValid(username)) {
      setStatus("idle");
      return;
    }

    setStatus("loading");

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void checkUsernameAvailability(username).then(
        (result: UsernameAvailability) => {
          if (!cancelled) {
            setStatus(result);
          }
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [rawValue]);

  return status;
}

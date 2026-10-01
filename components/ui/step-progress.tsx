"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "@/lib/motion";

type StepProgressProps = {
  currentStep: number;
  totalSteps: number;
};

const ACTIVE = "#A4A1FF";
const INACTIVE = "#7E7E7E";
const DOT = 8;
const PILL = 40;
const STORAGE_KEY = "trace-step-progress";

function readOriginStep(fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function StepProgress({ currentStep, totalSteps }: StepProgressProps) {
  const reduce = useReducedMotion();
  const [originStep] = useState(() => readOriginStep(currentStep));

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(currentStep));
  }, [currentStep]);

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 };

  const colorTransition = reduce
    ? { duration: 0 }
    : { duration: 0.35, ease: easeOut };

  return (
    <div
      className="flex items-center gap-1"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${currentStep} of ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const wasActive = step === originStep;
        const filled = isActive || step < currentStep;
        const wasFilled = wasActive || step < originStep;

        return (
          <motion.span
            key={step}
            initial={
              reduce
                ? false
                : {
                    width: wasActive ? PILL : DOT,
                    backgroundColor: wasFilled ? ACTIVE : INACTIVE,
                    scale: wasActive ? 1 : wasFilled ? 1 : 0.92,
                  }
            }
            animate={{
              width: isActive ? PILL : DOT,
              backgroundColor: filled ? ACTIVE : INACTIVE,
              scale: isActive ? 1 : filled ? 1 : 0.92,
            }}
            transition={{
              width: spring,
              scale: spring,
              backgroundColor: colorTransition,
            }}
            className="block h-2 origin-center rounded-full"
          />
        );
      })}
    </div>
  );
}

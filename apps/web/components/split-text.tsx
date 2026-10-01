"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, easeOut } from "@/lib/motion";

type SplitTextProps = {
  lines: string[][];
  className?: string;
};

/** Word-by-word load reveal. Each line stays on its own row. */
export function SplitText({ lines, className }: SplitTextProps) {
  const reduce = useReducedMotion();
  let wordIndex = 0;

  return (
    <span className={className}>
      {lines.map((line) => (
        <span key={line.join("-")} className="block">
          {line.map((word) => {
            const index = wordIndex;
            wordIndex += 1;
            return (
              <motion.span
                key={`${word}-${index}`}
                className="inline-block"
                initial={reduce ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: duration.base,
                  delay: reduce ? 0 : 0.2 + index * 0.06,
                  ease: easeOut,
                }}
              >
                {word}
                {"\u00A0"}
              </motion.span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

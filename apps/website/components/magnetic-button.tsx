"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, easeOut, focusRing } from "@/lib/motion";

type MagneticButtonProps = {
  href?: string;
  type?: "button" | "submit";
  variant?: "lilac" | "white";
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
};

const variants = {
  lilac: "bg-lilac text-ink",
  white: "bg-paper text-ink",
};

/** Scale plus a slight pull toward the pointer. Motion stays on transform. */
export function MagneticButton({
  href,
  type = "button",
  variant = "lilac",
  className,
  children,
  onClick,
}: MagneticButtonProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 22, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 260, damping: 22, mass: 0.4 });

  const onMove = (event: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    x.set(dx * 0.25);
    y.set(dy * 0.35);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const classes = cn(
    "inline-flex h-14 items-center justify-center rounded-full px-8 text-[15px] font-semibold",
    "transition-shadow duration-300",
    focusRing,
    variants[variant],
    className,
  );

  const motionProps = {
    className: classes,
    style: reduce ? undefined : { x: springX, y: springY },
    onMouseMove: onMove,
    onMouseLeave: reset,
    whileHover: reduce ? undefined : { scale: 1.045 },
    whileTap: reduce ? undefined : { scale: 0.98 },
    transition: { duration: duration.fast, ease: easeOut },
  };

  if (href) {
    return (
      <motion.a
        href={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
        {...motionProps}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
      {...motionProps}
    >
      {children}
    </motion.button>
  );
}

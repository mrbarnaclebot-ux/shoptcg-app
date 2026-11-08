"use client";

// Adapted from Watermelon UI "Labeled Progress Indicator" (MIT,
// registry.watermelon.sh/r/labeled-progress-indicator.json). Changes: an
// indeterminate progressbar role (the server reports no row count while it
// checks), labels mirrored in the progressbar value text, brand tokens, ruler ticks under a
// sweeping bar instead of the blue shimmer, no blur or 3D flip, and both
// motions stop under reduced motion.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export function LabeledProgressIndicator(props: {
  label: string;
  steps: string[];
  intervalMs?: number;
}) {
  const { steps, intervalMs = 2200 } = props;
  const [i, setI] = useState(0);
  const still = useReducedMotion();
  useEffect(() => {
    const t = setInterval(
      () => setI((n) => (n + 1) % steps.length),
      intervalMs,
    );
    return () => clearInterval(t);
  }, [steps.length, intervalMs]);
  return (
    <div className="flex max-w-md flex-col gap-2">
      {/* Visual only: the progressbar's aria-valuetext carries the same step. */}
      <p
        aria-hidden
        className="relative h-6 overflow-hidden text-sm font-semibold text-muted-foreground"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={i}
            initial={{ y: still ? 0 : 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: still ? 0 : -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 41 }}
            className="absolute inset-0"
          >
            {steps[i]}
          </motion.span>
        </AnimatePresence>
      </p>
      <div
        role="progressbar"
        aria-label={props.label}
        aria-valuetext={steps[i]}
        className="relative h-2 overflow-hidden rounded-[2px] bg-surface-2 ring-1 ring-border"
      >
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-brand"
          initial={{ x: still ? "100%" : "-100%" }}
          animate={still ? undefined : { x: "300%" }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </div>
      <div aria-hidden className="ruler" />
    </div>
  );
}

"use client";

// Adapted from Watermelon UI "Stepper" (MIT, registry.watermelon.sh/r/stepper.json).
// Changes: one square-cut box with a cut-line border (Show floor), poster-face
// digits, brand tokens instead of hard-coded greys, lucide icons instead of
// react-icons, critically damped digits (no overshoot, no blur), a labelled
// group with a polite live value, 44px targets, and reduced motion via the
// app-wide MotionConfig plus useReducedMotion for the digit roll.
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const ROLL = { type: "spring", stiffness: 420, damping: 41 } as const;

function useDigitTicks(digits: string[]) {
  const [prev, setPrev] = useState<{ digits: string[]; ticks: number[] }>({
    digits: [],
    ticks: [],
  });
  const lenDiff = digits.length - prev.digits.length;
  const ticks = digits.map((d, i) => {
    const p = i - lenDiff;
    const tick = p >= 0 ? (prev.ticks[p] ?? 0) : 0;
    return p >= 0 && prev.digits[p] === d ? tick : tick + 1;
  });
  if (prev.digits.join("") !== digits.join("")) setPrev({ digits, ticks });
  return ticks;
}

export function Stepper(props: {
  value: number;
  min?: number;
  max?: number;
  label: string;
  onStep: (delta: 1 | -1) => void;
}) {
  const { value, min = 0, max = 9999 } = props;
  const [dir, setDir] = useState(1);
  const still = useReducedMotion();
  const digits = String(value).split("");
  const ticks = useDigitTicks(digits);
  const step = (delta: 1 | -1) => {
    setDir(delta);
    props.onStep(delta);
  };
  const btn =
    "grid size-11 place-items-center transition-colors duration-150 hover:bg-[color-mix(in_oklch,currentColor_10%,transparent)] active:translate-y-px disabled:opacity-35 focus-visible:outline-offset-[-2px]";
  const shift = still ? 0 : 14;
  return (
    <div
      role="group"
      aria-label={props.label}
      className="inline-flex items-center shadow-[inset_0_0_0_1.5px_var(--border-strong)]"
    >
      <button
        type="button"
        className={btn}
        aria-label="One fewer"
        disabled={value <= min}
        onClick={() => step(-1)}
      >
        <Minus aria-hidden className="size-5" />
      </button>
      <span className="font-display num relative flex h-11 w-11 items-center justify-center overflow-hidden text-[1.375rem] font-extrabold">
        <output aria-live="polite" className="sr-only">
          {value}
        </output>
        {digits.map((d, i) => (
          <span
            key={`${i}-${digits.length}`}
            aria-hidden
            className="relative h-7 w-[0.62em]"
          >
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.span
                key={ticks[i]}
                custom={dir}
                initial={{ y: dir * shift, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -dir * shift, opacity: 0 }}
                transition={ROLL}
                className="absolute inset-0 flex items-center justify-center"
              >
                {d}
              </motion.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
      <button
        type="button"
        className={btn}
        aria-label="One more"
        disabled={value >= max}
        onClick={() => step(1)}
      >
        <Plus aria-hidden className="size-5" />
      </button>
    </div>
  );
}

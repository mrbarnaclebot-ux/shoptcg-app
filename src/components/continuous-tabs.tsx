"use client";

// Adapted from Watermelon UI "Continuous Tabs" (MIT,
// registry.watermelon.sh/r/continuous-tabs.json). Changes: renders links (the
// filter lives in the URL, so it works before hydration and is shareable)
// marked with aria-current instead of local state; Show floor styling (a
// lamp-orange bar slides under the current tab on a ruled baseline, instead of
// a pill); 44px hit areas; no mount gate (it rendered null on the server); and
// a critically damped slide. Reduced motion comes from the app-wide MotionConfig.
import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";

const SLIDE = { type: "spring", stiffness: 420, damping: 41 } as const;

export function ContinuousTabs(props: {
  id: string;
  label: string;
  tabs: readonly { href: string; label: string; on: boolean }[];
}) {
  return (
    <LayoutGroup id={props.id}>
      <nav
        aria-label={props.label}
        className="flex shrink-0 items-end border-b-[1.5px] border-border"
      >
        {props.tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            scroll={false}
            aria-current={tab.on ? "true" : undefined}
            className="relative -mb-[1.5px] inline-flex min-h-11 min-w-11 shrink-0 items-end justify-center px-3 pb-2.5 text-[0.9375rem] font-medium text-muted-foreground transition-colors duration-150 hover:text-text aria-[current=true]:font-bold aria-[current=true]:text-text"
          >
            {tab.label}
            {tab.on && (
              <motion.span
                layoutId="bar"
                transition={SLIDE}
                className="absolute inset-x-0 bottom-0 h-1 bg-brand"
              />
            )}
          </Link>
        ))}
      </nav>
    </LayoutGroup>
  );
}

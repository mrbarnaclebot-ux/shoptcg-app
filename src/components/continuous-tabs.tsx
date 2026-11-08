"use client";

// Adapted from Watermelon UI "Continuous Tabs" (MIT,
// registry.watermelon.sh/r/continuous-tabs.json). Changes: renders links (the
// filter lives in the URL, so it works before hydration and is shareable)
// marked with aria-current instead of local state, brand tokens instead of
// hard-coded greys, squared slab corners, 44px hit areas, no mount gate (it
// rendered null on the server), and a critically damped slide. Reduced motion
// comes from the app-wide MotionConfig.
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
        className="flex shrink-0 items-center rounded-sm bg-surface px-0.5 ring-1 ring-border"
      >
        {props.tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            scroll={false}
            aria-current={tab.on ? "true" : undefined}
            className="group relative inline-flex h-11 shrink-0 items-center px-1"
          >
            <span className="relative inline-flex h-9 items-center px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 group-hover:text-text group-aria-[current=true]:text-sunrise-200">
              {tab.on && (
                <motion.span
                  layoutId="pill"
                  transition={SLIDE}
                  className="absolute inset-0 rounded-sm bg-brand-bg ring-1 ring-brand"
                />
              )}
              <span className="relative">{tab.label}</span>
            </span>
          </Link>
        ))}
      </nav>
    </LayoutGroup>
  );
}

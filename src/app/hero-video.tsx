"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Conn = { saveData?: boolean };

const WIDE = "(min-width: 768px)";
const CALM = "(prefers-reduced-motion: reduce)";

// The loop is decoration: only on wide screens, never under reduced motion or
// Save-Data. Re-checked when either media query changes.
function wantsVideo() {
  const conn = (navigator as Navigator & { connection?: Conn }).connection;
  return (
    !conn?.saveData && matchMedia(WIDE).matches && !matchMedia(CALM).matches
  );
}

function subscribe(cb: () => void) {
  const mqs = [matchMedia(WIDE), matchMedia(CALM)];
  mqs.forEach((m) => m.addEventListener("change", cb));
  return () => mqs.forEach((m) => m.removeEventListener("change", cb));
}

// Starts only after the page has loaded, so it can't compete with the photo
// underneath (the LCP image), which also stands in until the first frame.
function useLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const done = () => setLoaded(true);
    if (document.readyState === "complete") done();
    else addEventListener("load", done, { once: true });
    return () => removeEventListener("load", done);
  }, []);
  return loaded;
}

export function HeroVideo() {
  const allowed = useSyncExternalStore(subscribe, wantsVideo, () => false);
  const loaded = useLoaded();
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  if (!allowed || !loaded) return null;
  // WCAG 2.2.2: motion that runs past 5 s gets a pause; the push-in stops too.
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (paused) void v.play();
    else v.pause();
    setPaused(!paused);
  };
  return (
    <>
      <video
        ref={ref}
        aria-hidden
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        data-paused={paused || undefined}
        className="hero-video absolute inset-0 size-full object-cover"
      >
        <source src="/media/hero.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        className="absolute top-24 right-14 z-10 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0/0.25)] hover:text-text"
      >
        {paused ? (
          <Play aria-hidden className="size-4" />
        ) : (
          <Pause aria-hidden className="size-4" />
        )}
        {paused ? "Play video" : "Pause video"}
      </button>
    </>
  );
}

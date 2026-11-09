"use client";

import { useEffect, useState } from "react";

type Conn = { saveData?: boolean };

// The loop is decoration: only on wide screens, never under reduced motion or
// Save-Data, and only after the page has loaded so it can't compete with the
// poster (the LCP image). Until then, and instead, the poster shows.
function wantsVideo() {
  const conn = (navigator as Navigator & { connection?: Conn }).connection;
  return (
    !conn?.saveData &&
    matchMedia("(min-width: 768px)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function HeroVideo() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!wantsVideo()) return;
    const start = () => setOn(true);
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
    return () => removeEventListener("load", start);
  }, []);
  if (!on) return null;
  return (
    <video
      aria-hidden
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      poster="/media/hero-poster.jpg"
      className="hero-video absolute inset-0 size-full object-cover"
    >
      <source src="/media/hero.mp4" type="video/mp4" />
    </video>
  );
}

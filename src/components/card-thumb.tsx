import { cn } from "cn";

// Slabs are taller than raw cards; sealed product is roughly square (UI-SPEC 4).
const ASPECT = {
  raw: "aspect-[63/88]",
  graded: "aspect-[3/5]",
  sealed: "aspect-square",
} as const;

export function CardThumb({
  src,
  kind,
  className,
}: {
  src: string | null;
  kind: keyof typeof ASPECT;
  className?: string;
}) {
  const box = cn(
    "w-10 shrink-0 overflow-hidden rounded-[4.6%/3.3%] bg-surface-2",
    ASPECT[kind],
    className,
  );
  if (!src) return <span aria-hidden className={cn(box, "block")} />;
  // Plain img: custom items may point at any https host, which next/image
  // would have to allowlist; thumbs are tiny so optimisation buys little.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(box, kind === "sealed" ? "object-contain" : "object-cover")}
    />
  );
}

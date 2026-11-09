import { cn } from "cn";
import { LANGUAGE_LABEL } from "@/lib/format";

// Slabs are taller than raw cards; sealed product is roughly square (UI-SPEC 4).
const ASPECT = {
  raw: "aspect-[63/88]",
  graded: "aspect-[3/5]",
  sealed: "aspect-square",
} as const;

// Outline drawings for items with no photo, one per kind, in a 0 0 24 24 box.
// ponytail: line placeholders until the item has a photo.
const OUTLINE = {
  raw: <rect x="5" y="2" width="14" height="20" rx="1.5" />,
  graded: (
    <>
      <rect x="5" y="1.5" width="14" height="21" rx="1.5" />
      <path d="M5 6.5h14M8 9.5h8v10H8z" />
    </>
  ),
  sealed: (
    <path d="M3.5 8 12 4l8.5 4v9L12 21l-8.5-4zM3.5 8 12 12l8.5-4M12 12v9" />
  ),
} as const;

type Kind = keyof typeof ASPECT;

function Placeholder(props: {
  kind: Kind;
  language?: keyof typeof LANGUAGE_LABEL;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        props.className,
        "relative grid place-items-center text-muted-foreground",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="w-3/4"
      >
        {OUTLINE[props.kind]}
      </svg>
      {props.language && (
        <span className="absolute bottom-0.5 text-[9px] leading-none font-semibold">
          {LANGUAGE_LABEL[props.language]}
        </span>
      )}
    </span>
  );
}

export function CardThumb({
  src,
  kind,
  language,
  className,
}: {
  src: string | null;
  kind: Kind;
  language?: keyof typeof LANGUAGE_LABEL;
  className?: string;
}) {
  const box = cn(
    "w-10 shrink-0 overflow-hidden bg-surface-2",
    ASPECT[kind],
    className,
  );
  if (!src)
    return <Placeholder kind={kind} language={language} className={box} />;
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

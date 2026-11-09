import { cn } from "cn";
import Image from "next/image";
import Link from "next/link";
import { Stamp } from "@/components/stamp";
import { TapeHatch } from "@/components/tape-hatch";
import { formatAlt, usdTag } from "@/lib/fx";
import { gradeLabel, LANGUAGE_LABEL } from "@/lib/format";
import type { PublicItem } from "@/lib/storefront";
import { AddButton } from "./list-island";

// Slabs are taller than raw cards; sealed product is roughly square.
export const ART_ASPECT = {
  raw: "aspect-[63/88]",
  graded: "aspect-[3/5]",
  sealed: "aspect-square",
} as const;

// Japanese and Chinese names get their own lang so the right glyphs render.
export const HTML_LANG = { en: undefined, ja: "ja", zh: "zh" } as const;

/** "Base Set 4/102. NM", "Graded. PSA 10" or "Sealed". */
export function metaLine(it: PublicItem) {
  const grade = gradeLabel(it);
  if (it.kind !== "raw")
    return it.kind === "graded" ? `Graded. ${grade}` : grade;
  const where = [it.setName, it.number].filter(Boolean).join(" ");
  return where ? `${where}. ${grade}` : grade;
}

/** "3 left", "Last one", the hold line, or "Sold out". */
export function stockLine(it: PublicItem) {
  if (!it.qty) return "Sold out";
  if (!it.available)
    return `On hold. Back in about ${it.holdMin ?? 1} min if not sold.`;
  return it.available === 1 ? "Last one" : `${it.available} left`;
}

/** Card art or a paper placeholder with the set number in the poster face. */
export function Art(props: {
  it: PublicItem;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  const { it } = props;
  return (
    <span
      className={cn(
        "relative block overflow-hidden bg-surface",
        ART_ASPECT[it.kind],
        props.className,
      )}
    >
      {it.imageUrl ? (
        <Image
          src={it.imageUrl}
          alt=""
          fill
          sizes={props.sizes}
          quality={70}
          loading={props.eager ? "eager" : "lazy"}
          className={
            it.kind === "sealed" ? "object-contain p-3" : "object-cover"
          }
        />
      ) : (
        <span className="paper absolute inset-0 grid place-items-center p-2 text-center">
          <span className="font-display num text-[1.75rem] leading-none font-black text-muted-foreground">
            {it.number ?? LANGUAGE_LABEL[it.language]}
          </span>
        </span>
      )}
      {it.language !== "en" && (
        <span className="absolute top-1.5 left-1.5 bg-bg px-1.5 py-0.5 text-xs font-semibold">
          {LANGUAGE_LABEL[it.language]}
        </span>
      )}
    </span>
  );
}

export function Tile(props: {
  it: PublicItem;
  slug: string;
  currency: string | null;
  canAdd: boolean;
  eager: boolean;
}) {
  const { it } = props;
  const soldOut = !it.qty;
  const onHold = !soldOut && !it.available;
  const art = (
    <Art
      it={it}
      eager={props.eager}
      sizes="(min-width:1024px) 180px, 45vw"
      className={soldOut ? "opacity-60 grayscale-[0.8]" : undefined}
    />
  );
  return (
    <article className="relative flex flex-col [contain-intrinsic-size:auto_420px] [content-visibility:auto]">
      <Link
        href={`/${props.slug}/item/${it.id}`}
        className="group flex flex-col"
      >
        {onHold ? (
          <TapeHatch label="On hold" className="block">
            {art}
          </TapeHatch>
        ) : (
          art
        )}
        {it.underPct !== null && !soldOut && (
          <Stamp className="mt-2.5 self-start">
            {it.underPct}% under market
          </Stamp>
        )}
        <h3
          lang={HTML_LANG[it.language]}
          className="mt-2 line-clamp-2 text-[0.96875rem] leading-tight font-semibold group-hover:underline"
        >
          {it.name}
        </h3>
      </Link>
      <p className="num mt-0.5 text-xs text-muted-foreground">{metaLine(it)}</p>
      <div className="mt-2 flex min-h-11 items-end justify-between gap-2">
        {soldOut ? <span /> : <PriceBlock it={it} currency={props.currency} />}
        {props.canAdd &&
          !soldOut &&
          it.price !== null &&
          (onHold ? (
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center bg-surface opacity-40"
            />
          ) : (
            <AddButton
              slug={props.slug}
              id={it.id}
              name={it.name}
              price={it.price}
            />
          ))}
      </div>
      <p
        className={cn(
          "mt-1.5 text-xs",
          it.available === 1 && !onHold
            ? "font-semibold text-text"
            : "text-muted-foreground",
          soldOut && "text-subtle",
        )}
      >
        {stockLine(it)}
      </p>
    </article>
  );
}

function PriceBlock({
  it,
  currency,
}: {
  it: PublicItem;
  currency: string | null;
}) {
  if (it.price === null)
    return <span className="text-sm font-semibold">Ask at the table</span>;
  return (
    <span className="flex flex-col">
      <span className="font-display num text-[1.875rem] leading-[0.9] font-extrabold">
        {usdTag(it.price)}
      </span>
      {currency && it.alt !== null && (
        <span className="num mt-1 text-xs text-muted-foreground">
          approx. {formatAlt(currency, it.alt)}
        </span>
      )}
    </span>
  );
}

/** Same box as a tile so the grid does not jump when stock streams in. */
export function TileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <span className="block aspect-[63/88] animate-pulse bg-surface" />
      <span className="mt-3 block h-4 w-3/4 bg-surface" />
      <span className="mt-2 block h-3 w-1/2 bg-surface" />
      <span className="mt-3 block h-8 w-16 bg-surface" />
    </div>
  );
}

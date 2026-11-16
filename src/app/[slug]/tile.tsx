import { cn } from "cn";
import Image from "next/image";
import Link from "next/link";
import { Stamp } from "@/components/stamp";
import { TapeHatch } from "@/components/tape-hatch";
import { formatAlt, usdTag } from "@/lib/fx";
import { isCardArt } from "@/lib/pricing/images";
import { gradeLabel, LANGUAGE_LABEL } from "@/lib/format";
import type { PublicItem } from "@/lib/storefront";
import { AddButton } from "./list-island";

// One card-shaped box for every kind, so a row of tiles lines up. A catalog
// card's scan is the card itself and fills it; sealed product and vendor
// photos can be any shape, so they show whole on the surface colour.
const fills = (it: Pick<PublicItem, "kind" | "catalogItemId">) =>
  (it.kind === "raw" || it.kind === "graded") && it.catalogItemId !== null;

const PLACEHOLDER = {
  raw: "Card",
  graded: "Slab",
  sealed: "Sealed",
  other: "Item",
};

// Japanese and Chinese names get their own lang so the right glyphs render.
export const HTML_LANG = { en: undefined, ja: "ja", zh: "zh" } as const;

/** "Base Set 4/102. NM", "Graded. PSA 10", "Sealed" or an other item's category. */
export function metaLine(
  it: Pick<
    PublicItem,
    "kind" | "setName" | "number" | "condition" | "grader" | "grade"
  >,
) {
  if (it.kind === "other") return it.setName || "Other";
  const grade = gradeLabel(it);
  if (it.kind !== "raw")
    return it.kind === "graded" ? `Graded. ${grade}` : grade;
  const where = [it.setName, it.number].filter(Boolean).join(" ");
  return where ? `${where}. ${grade}` : grade;
}

/** "3 left", "Last one", the hold line, or "Sold out". Short fits a tile's one line. */
export function stockLine(it: PublicItem, short = false) {
  if (!it.qty) return "Sold out";
  if (!it.available)
    return short
      ? `On hold, about ${it.holdMin ?? 1} min`
      : `On hold. Back in about ${it.holdMin ?? 1} min if not sold.`;
  return it.available === 1 ? "Last one" : `${it.available} left`;
}

/** Card art or a paper placeholder with the set number in the poster face. */
export function Art(props: {
  it: PublicItem;
  sizes: string;
  eager?: boolean;
  className?: string;
  /** Sold out: fades the art, but never the small print, which must stay readable. */
  dim?: boolean;
  /** Laid over the art, so it never makes the tile taller. */
  children?: React.ReactNode;
}) {
  const { it } = props;
  return (
    <span
      className={cn(
        "relative block aspect-[63/88] overflow-hidden bg-surface",
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
          // Vendor photos are already stored small, on a host not in remotePatterns.
          unoptimized={!isCardArt(it.imageUrl)}
          loading={props.eager ? "eager" : "lazy"}
          className={cn(
            fills(it) ? "object-cover" : "object-contain p-3",
            props.dim && DIM,
          )}
        />
      ) : (
        // No photo: an empty case well that still says which card it is.
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center shadow-[inset_0_0_0_1px_var(--border)]">
          <span
            className={cn(
              "font-display num text-[2rem] leading-none font-black text-muted-foreground",
              props.dim && DIM,
            )}
          >
            {it.number ?? PLACEHOLDER[it.kind]}
          </span>
          {it.setName && (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {it.setName}
            </span>
          )}
        </span>
      )}
      {it.language !== "en" && it.kind !== "other" && (
        <span className="absolute top-1.5 left-1.5 bg-bg px-1.5 py-0.5 text-xs font-semibold">
          {LANGUAGE_LABEL[it.language]}
        </span>
      )}
      {props.children}
    </span>
  );
}

const DIM = "opacity-60 grayscale-[0.8]";

export function Tile(props: {
  it: PublicItem;
  slug: string;
  currency: string | null;
  canAdd: boolean;
  /** "Ask at the table" or "Ask the seller", for an unpriced item. */
  askPrice: string;
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
      dim={soldOut}
    >
      {it.underPct !== null && !soldOut && (
        <Stamp className="absolute bottom-2 left-2 bg-bg">
          {it.underPct}% under market
        </Stamp>
      )}
    </Art>
  );
  // Every row has a fixed height, so the add buttons line up across a row.
  return (
    <article
      data-tile
      className="relative flex flex-col [contain-intrinsic-size:auto_420px] [content-visibility:auto]"
    >
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
        {/* Two lines kept whether the name needs them or not. */}
        <h3
          lang={HTML_LANG[it.language]}
          className="mt-2 line-clamp-2 h-[2lh] text-[0.96875rem] leading-tight font-semibold group-hover:underline"
        >
          {it.name}
        </h3>
      </Link>
      <p className="num mt-0.5 truncate text-xs text-muted-foreground">
        {metaLine(it)}
      </p>
      <div className="mt-2 flex h-14 items-end justify-between gap-2">
        {soldOut ? (
          <span />
        ) : (
          <PriceBlock
            it={it}
            currency={props.currency}
            askPrice={props.askPrice}
          />
        )}
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
          "mt-1.5 truncate text-xs",
          it.available === 1 && !onHold
            ? "font-semibold text-text"
            : "text-muted-foreground",
          soldOut && "text-muted-foreground",
        )}
      >
        {stockLine(it, true)}
      </p>
    </article>
  );
}

function PriceBlock({
  it,
  currency,
  askPrice,
}: {
  it: PublicItem;
  currency: string | null;
  askPrice: string;
}) {
  if (it.price === null)
    return <span className="text-sm font-semibold">{askPrice}</span>;
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

import { CardThumb } from "@/components/card-thumb";
import { Ticket } from "@/components/ticket";
import type { PreviewRow } from "@/lib/csv-import";
import { usd } from "@/lib/format";

// Outlined tags on the paper receipt; colour plus the word, never colour alone.
const BADGE = {
  matched: ["Matched", "text-success"],
  custom: ["Custom", "text-muted-foreground"],
  error: ["Error", "text-danger"],
} as const;

/** A custom row with no price imports fine but shows "No price" until the vendor sets one. */
export const needsPrice = (r: PreviewRow) =>
  r.row?.kind === "custom" && !r.row.input.overridePrice;

const BADGE_BASE =
  "px-1.5 py-1 text-xs leading-none font-semibold whitespace-nowrap shadow-[inset_0_0_0_1px_currentColor]";

function stockOf(r: PreviewRow) {
  const input = r.row?.input;
  if (!input) return { qty: "", price: "" };
  const price = input.overridePrice;
  return {
    qty: String(input.qty),
    price: price ? usd(Number(price)) : needsPrice(r) ? "None" : "Market",
  };
}

function Summary({ rows }: { rows: PreviewRow[] }) {
  const n = (s: PreviewRow["status"]) =>
    rows.filter((r) => r.status === s).length;
  const ready = rows.length - n("error");
  const unpriced = rows.filter(needsPrice).length;
  return (
    <p className="text-muted-foreground">
      <span className="num text-text">{ready}</span> ready:{" "}
      <span className="num text-text">{n("matched")}</span> matched,{" "}
      <span className="num text-text">{n("custom")}</span> custom.
      {unpriced > 0 && (
        <span className="text-warning">
          {" "}
          {unpriced} {unpriced === 1 ? "item needs" : "items need"} a price
          after import.
        </span>
      )}
      {n("error") > 0 && (
        <span className="text-danger">
          {" "}
          {n("error")} {n("error") === 1 ? "row has" : "rows have"} errors and
          will be skipped.
        </span>
      )}
    </p>
  );
}

function Row({ r }: { r: PreviewRow }) {
  const [label, tone] = BADGE[r.status];
  const { qty, price } = stockOf(r);
  const own = r.row?.kind === "custom" ? r.row.input : null;
  return (
    <tr className="border-b border-dashed border-border align-middle">
      <td className="num py-2 pr-3 text-sm text-subtle">{r.line}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-3">
          <CardThumb
            src={r.imageUrl}
            kind={own?.kind ?? "raw"}
            language={own?.language}
            className="w-8"
          />
          <div className="min-w-0">
            <p className="font-semibold">{r.name || "-"}</p>
            <p className="text-sm text-muted-foreground">{r.detail}</p>
            {r.status !== "error" && (
              <p className="text-sm text-muted-foreground md:hidden">
                Qty {qty}. {price}
              </p>
            )}
            {r.note && (
              <p
                className={`text-sm ${r.status === "error" ? "text-danger" : "text-warning"}`}
              >
                {r.note}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="num hidden py-2 pr-3 text-right md:table-cell">{qty}</td>
      <td className="num hidden py-2 pr-3 text-right md:table-cell">{price}</td>
      <td className="py-2">
        <div className="flex flex-col items-start gap-1">
          <span className={`${BADGE_BASE} ${tone}`}>{label}</span>
          {needsPrice(r) && (
            <span className={`${BADGE_BASE} text-warning`}>Set a price</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  if (!rows.length) return <p>That file has a header row but no items.</p>;
  const th = "py-2 pr-3 text-sm font-semibold text-muted-foreground";
  return (
    // The preview is a receipt: every row on paper before anything is saved.
    <Ticket
      as="div"
      no={String(rows.length).padStart(4, "0")}
      className="[--stub:2.25rem]"
      bodyClassName="flex flex-col gap-3 p-4 md:p-5"
    >
      <Summary rows={rows} />
      <table className="w-full border-collapse text-left">
        <thead className="border-b-[1.5px] border-text">
          <tr>
            <th className={th}>Row</th>
            <th className={th}>Item</th>
            <th className={`${th} hidden text-right md:table-cell`}>Qty</th>
            <th className={`${th} hidden text-right md:table-cell`}>Price</th>
            <th className={th}>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.line} r={r} />
          ))}
        </tbody>
      </table>
    </Ticket>
  );
}

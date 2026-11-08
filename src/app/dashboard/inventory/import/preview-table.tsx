import { CardThumb } from "@/components/card-thumb";
import type { PreviewRow } from "@/lib/csv-import";
import { usd } from "@/lib/format";

const BADGE = {
  matched: ["Matched", "bg-success-bg text-success"],
  custom: ["Custom", "bg-surface-2 text-muted-foreground"],
  error: ["Error", "bg-danger-bg text-danger"],
} as const;

function stockOf(r: PreviewRow) {
  const input = r.row?.input;
  if (!input) return { qty: "", price: "" };
  const price = input.overridePrice;
  return {
    qty: String(input.qty),
    price: price ? usd(Number(price)) : "Market",
  };
}

function Summary({ rows }: { rows: PreviewRow[] }) {
  const n = (s: PreviewRow["status"]) =>
    rows.filter((r) => r.status === s).length;
  const ready = rows.length - n("error");
  return (
    <p className="text-muted-foreground">
      <span className="num text-text">{ready}</span> ready:{" "}
      <span className="num text-text">{n("matched")}</span> matched,{" "}
      <span className="num text-text">{n("custom")}</span> custom.
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
  const kind = r.row?.kind === "custom" ? r.row.input.kind : "raw";
  return (
    <tr className="border-b border-border align-middle">
      <td className="num py-2 pr-3 text-sm text-subtle">{r.line}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-3">
          <CardThumb src={r.imageUrl} kind={kind} className="w-8" />
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
        <span
          className={`rounded-sm px-1.5 py-0.5 text-xs font-semibold tracking-[0.06em] uppercase ${tone}`}
        >
          {label}
        </span>
      </td>
    </tr>
  );
}

export function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  if (!rows.length) return <p>That file has a header row but no items.</p>;
  const th =
    "py-2 pr-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase";
  return (
    <div className="flex flex-col gap-3">
      <Summary rows={rows} />
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-border">
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
    </div>
  );
}

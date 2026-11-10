import { CardThumb, kindOf } from "@/components/card-thumb";
import { usd, withLanguage } from "@/lib/format";
import { altPrice, formatAlt } from "@/lib/fx";
import { METHOD_LABEL } from "@/lib/receipt-email";

type Sale = {
  subtotal: string;
  discount: string;
  total: string;
  paymentMethod: keyof typeof METHOD_LABEL;
  paymentNote: string | null;
  secondCurrency: string | null;
  fxRate: string | null;
  lines: {
    lineNo: number;
    name: string;
    setName: string | null;
    number: string | null;
    gradeLabel: string | null;
    language: string;
    imageUrl: string | null;
    qty: number;
    unitPrice: string;
  }[];
};

export const paidBy = (s: Pick<Sale, "paymentMethod" | "paymentNote">) =>
  s.paymentNote ?? METHOD_LABEL[s.paymentMethod];

/** The lines and totals of a saved sale, for seller and buyer alike. */
export function ReceiptSummary({ sale: s }: { sale: Sale }) {
  const alt = altPrice(Number(s.total), s.fxRate ? Number(s.fxRate) : null);
  return (
    <>
      <ul className="text-sm">
        {s.lines.map((l) => (
          <li
            key={l.lineNo}
            className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-border py-1.5"
          >
            <CardThumb
              src={l.imageUrl}
              kind={kindOf(l.gradeLabel)}
              number={l.number}
              className="w-[34px]"
            />
            <span className="min-w-0">
              {l.name}
              <small className="block text-sm text-muted-foreground">
                {withLanguage(
                  [l.setName, l.number, l.gradeLabel].filter(Boolean).join(" "),
                  l.language,
                )}
              </small>
            </span>
            <span className="num">
              {l.qty} x {usd(Number(l.unitPrice))}
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 border-t-[1.5px] border-text pt-2">
        {Number(s.discount) > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd className="num">{usd(Number(s.subtotal))}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Discount</dt>
              <dd className="num">-{usd(Number(s.discount))}</dd>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between font-semibold">
          <dt>Total</dt>
          <dd className="font-display num text-[2.25rem] leading-none font-extrabold">
            {usd(Number(s.total))}
          </dd>
        </div>
        {s.secondCurrency && alt !== null && (
          <div className="num text-right text-sm text-muted-foreground">
            <dt className="sr-only">In {s.secondCurrency}</dt>
            <dd>
              approx. {formatAlt(s.secondCurrency, alt)} at {Number(s.fxRate)}{" "}
              to 1 USD
            </dd>
          </div>
        )}
      </dl>
      <p className="font-semibold">Paid by {paidBy(s)}</p>
    </>
  );
}

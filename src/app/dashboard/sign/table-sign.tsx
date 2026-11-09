import { qr } from "@/lib/qr";

export type SignSize = "a5" | "a4";

// Millimetres on paper; A4 scales the A5 layout by its width ratio.
const UNIT = { a5: 1, a4: 210 / 148 } as const;
const QR_MM = { a5: 80, a4: 110 } as const;

/**
 * The printed table sign. White stock and galaxy ink so it works in pure
 * black and white; the lamp band prints as mid grey on a mono printer.
 */
export function TableSign(props: {
  size: SignSize;
  name: string;
  url: string;
  shownUrl: string;
  tableLabel: string | null;
  nfc: boolean;
}) {
  const code = qr(props.url);
  const u = UNIT[props.size];
  return (
    <article
      className="table-sign"
      data-size={props.size}
      style={
        {
          "--u": `${u}mm`,
          "--qr": `${QR_MM[props.size]}mm`,
        } as React.CSSProperties
      }
    >
      <div className="ts-top">
        <h2 className="ts-name">{props.name}</h2>
        {props.tableLabel && (
          <p className="ts-table">
            Table<b>{props.tableLabel}</b>
          </p>
        )}
      </div>
      <p className="ts-line">Scan to see prices and stock</p>
      <svg
        className="ts-qr"
        viewBox={`0 0 ${code.size} ${code.size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${props.shownUrl}`}
      >
        <rect width={code.size} height={code.size} fill="#fff" />
        <path d={code.d} fill="#090911" />
      </svg>
      <p className="ts-url" data-testid="sign-url">
        {props.shownUrl}
      </p>
      <div className="ts-facts">
        <span>Market-checked prices</span>
        <span>Updated daily</span>
        <span>Pay at the table</span>
      </div>
      <div className="ts-foot">
        <span>Powered by shoptcg.app</span>
        {props.nfc && (
          <span className="ts-nfc">
            Or tap your phone here
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17" />
            </svg>
          </span>
        )}
      </div>
    </article>
  );
}

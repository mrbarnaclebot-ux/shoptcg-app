import { altPrice, formatAlt } from "@/lib/fx";
import { usd } from "@/lib/format";

// Hand-written table HTML: email clients ignore most CSS, and one template
// doesn't earn a React Email dependency. No remote fonts or tracking pixels.

export const METHOD_LABEL = {
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
} as const;

export type ReceiptData = {
  storeName: string;
  receiptNo: string;
  buyerName: string;
  createdAt: Date;
  subtotal: string;
  discount: string;
  total: string;
  method: keyof typeof METHOD_LABEL;
  note: string | null;
  secondCurrency: string | null;
  fxRate: string | null;
  lines: {
    name: string;
    meta: string;
    imageUrl: string | null;
    qty: number;
    unitPrice: string;
  }[];
  /** Only when the buyer is on the store's list. */
  unsubscribeUrl: string | null;
};

export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const money = (v: string) => usd(Number(v));
const FACE = "'Big Shoulders','Arial Narrow',Arial,sans-serif";
const INK = "#11131a";
const SEAL = "#5b5f6b";

const paidBy = (d: ReceiptData) =>
  d.method === "other" && d.note ? d.note : METHOD_LABEL[d.method];

function approx(d: ReceiptData) {
  const alt = altPrice(Number(d.total), d.fxRate ? Number(d.fxRate) : null);
  if (alt === null || !d.secondCurrency) return null;
  return `Approx. ${formatAlt(d.secondCurrency, alt)} at ${d.fxRate} ${d.secondCurrency} to 1 USD`;
}

function lineRow(l: ReceiptData["lines"][number]) {
  const thumb = l.imageUrl
    ? `<img src="${esc(l.imageUrl)}" alt="${esc(l.name)}" width="48" style="display:block;width:48px;height:auto;border:0">`
    : "";
  return `<tr>
<td width="60" style="padding:10px 0;border-top:1px solid #d8d0c0;vertical-align:top">${thumb}</td>
<td style="padding:10px 8px 10px 0;border-top:1px solid #d8d0c0;vertical-align:top;font:15px/1.35 Arial,sans-serif;color:${INK}">${esc(l.name)}<br><span style="font-size:13px;color:${SEAL}">${esc(l.meta)}</span></td>
<td align="right" style="padding:10px 0;border-top:1px solid #d8d0c0;vertical-align:top;white-space:nowrap;font:15px/1.35 Arial,sans-serif;color:${INK}">${l.qty} x ${esc(money(l.unitPrice))}</td>
</tr>`;
}

function sumRow(k: string, v: string) {
  return `<tr><td style="padding:2px 0;font:15px/1.4 Arial,sans-serif;color:${SEAL}">${k}</td><td align="right" style="padding:2px 0;font:15px/1.4 Arial,sans-serif;color:${INK}">${esc(v)}</td></tr>`;
}

export function renderReceipt(d: ReceiptData) {
  const store = esc(d.storeName);
  const when = d.createdAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const hasDiscount = Number(d.discount) > 0;
  const fx = approx(d);
  const unsub = d.unsubscribeUrl
    ? ` You&#39;re on ${store}&#39;s update list. <a href="${esc(d.unsubscribeUrl)}" style="color:${SEAL}">Unsubscribe.</a>`
    : "";
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${esc(d.receiptNo)}</title></head>
<body style="margin:0;padding:0;background:#11131a">
<div style="display:none;max-height:0;overflow:hidden">Your receipt from ${store}, ${esc(money(d.total))}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#11131a"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#f4efe6;border-top:4px solid #e8590c">
<tr><td style="padding:24px 24px 8px">
<div style="font:900 34px/1 ${FACE};color:${INK}">${store}</div>
<div style="padding-top:6px;font:15px/1.4 Arial,sans-serif;color:${SEAL}">Thanks, ${esc(d.buyerName)}. ${esc(when)} UTC</div>
</td></tr>
<tr><td style="padding:8px 24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.lines.map(lineRow).join("")}</table>
</td></tr>
<tr><td style="padding:8px 24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${INK}">
${hasDiscount ? sumRow("Subtotal", money(d.subtotal)) + sumRow("Discount", `-${money(d.discount)}`) : ""}
<tr><td style="padding:8px 0 0;font:700 15px/1.4 Arial,sans-serif;color:${INK}">Total</td><td align="right" style="padding:8px 0 0;font:900 34px/1 ${FACE};color:${INK}">${esc(money(d.total))}</td></tr>
${fx ? `<tr><td colspan="2" align="right" style="font:13px/1.4 Arial,sans-serif;color:${SEAL}">${esc(fx)}</td></tr>` : ""}
</table>
</td></tr>
<tr><td style="padding:14px 24px;border-top:2px dashed #b8ae9c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font:15px/1.4 Arial,sans-serif;color:${INK}">Receipt <b>${esc(d.receiptNo)}</b></td>
<td align="right" style="font:15px/1.4 Arial,sans-serif;color:${INK}">Paid by <b>${esc(paidBy(d))}</b></td>
</tr></table>
</td></tr>
</table>
<p style="max-width:600px;margin:14px auto 0;font:13px/1.5 Arial,sans-serif;color:#a6a8b0">You got this because you bought from ${store} on shoptcg.app.${unsub}</p>
</td></tr></table>
</body></html>`;
  const text = [
    `Your receipt from ${d.storeName}`,
    `${d.receiptNo}, ${when} UTC`,
    "",
    ...d.lines.map(
      (l) => `${l.qty} x ${l.name} (${l.meta}): ${money(l.unitPrice)} each`,
    ),
    "",
    ...(hasDiscount
      ? [`Subtotal ${money(d.subtotal)}`, `Discount -${money(d.discount)}`]
      : []),
    `Total ${money(d.total)}`,
    ...(fx ? [fx] : []),
    `Paid by ${paidBy(d)}`,
    "",
    `You got this because you bought from ${d.storeName} on shoptcg.app.`,
    ...(d.unsubscribeUrl
      ? [`You're on the store's update list. Unsubscribe: ${d.unsubscribeUrl}`]
      : []),
  ].join("\n");
  // A store name can't smuggle a header through the subject.
  const subject = `Your receipt from ${d.storeName} (${d.receiptNo})`.replace(
    /[\r\n]+/g,
    " ",
  );
  return { subject, html, text };
}

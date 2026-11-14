// Online checkout: how a buyer gets the cards (delivery or pickup) and pays
// (cash on the day or bank transfer). The store picks which it offers; with
// none, the cart asks nothing and the vendor arranges both, as before.

// Plain constants: client components import this file, the schema too.
export const FULFIL = ["delivery", "pickup"] as const;
export const PAY_WITH = ["cash", "transfer"] as const;

export type Fulfil = (typeof FULFIL)[number];
export type PayWith = (typeof PAY_WITH)[number];

export type CheckoutOffer = {
  offerDelivery: boolean;
  offerPickup: boolean;
  acceptCash: boolean;
  acceptTransfer: boolean;
};

export type Checkout = {
  fulfil: Fulfil | null;
  payWith: PayWith | null;
  buyerPhone: string | null;
  deliveryAddress: string | null;
};

export type CheckoutErrors = Partial<
  Record<"fulfil" | "payWith" | "phone" | "address", string>
>;

const NONE: CheckoutOffer = {
  offerDelivery: false,
  offerPickup: false,
  acceptCash: false,
  acceptTransfer: false,
};

/** What a store offers at its cart: nothing at a table, where it's settled in person. */
export const storeOffer = (s: CheckoutOffer & { sellingMode: string }) =>
  s.sellingMode === "online"
    ? {
        offerDelivery: s.offerDelivery,
        offerPickup: s.offerPickup,
        acceptCash: s.acceptCash,
        acceptTransfer: s.acceptTransfer,
      }
    : NONE;

export const fulfilOptions = (s: CheckoutOffer) =>
  FULFIL.filter((f) => (f === "delivery" ? s.offerDelivery : s.offerPickup));

export const payOptions = (s: CheckoutOffer) =>
  PAY_WITH.filter((p) => (p === "cash" ? s.acceptCash : s.acceptTransfer));

export const FULFIL_LABEL: Record<Fulfil, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
};

export function payLabel(pay: PayWith, fulfil: Fulfil | null) {
  if (pay === "transfer") return "Bank transfer";
  if (fulfil === "delivery") return "Cash on delivery";
  if (fulfil === "pickup") return "Cash at pickup";
  return "Cash";
}

const PHONE = /^\+?[0-9 ()-]{7,20}$/;

/** The cart's checkout fields, checked against what this store offers. */
export function parseCheckout(
  s: CheckoutOffer,
  form: Record<string, unknown>,
): { ok: true; value: Checkout } | { errors: CheckoutErrors } {
  const text = (k: string) => String(form[k] ?? "").trim();
  const errors: CheckoutErrors = {};
  // One option is a fact, not a question: it needs no pick.
  const pick = <T extends string>(options: readonly T[], raw: string) =>
    options.length === 1
      ? options[0]
      : (options.find((o) => o === raw) ?? null);

  const fulfils = fulfilOptions(s);
  const fulfil = pick(fulfils, text("fulfil"));
  if (fulfils.length && !fulfil) errors.fulfil = "Choose delivery or pickup.";
  const pays = payOptions(s);
  const payWith = pick(pays, text("payWith"));
  if (pays.length && !payWith) errors.payWith = "Choose how you'll pay.";

  const phone = text("phone") || null;
  if (phone && !PHONE.test(phone))
    errors.phone = "Enter a phone number like 077 123 4567.";
  else if (!phone && fulfil === "delivery")
    errors.phone = "Enter a phone number for the delivery.";

  const address = fulfil === "delivery" ? text("address") : "";
  if (fulfil === "delivery" && address.length < 5)
    errors.address = "Enter where to deliver.";
  else if (address.length > 300)
    errors.address = "Use 300 characters or fewer.";

  if (Object.keys(errors).length) return { errors };
  return {
    ok: true,
    value: {
      fulfil,
      payWith,
      buyerPhone: phone,
      deliveryAddress: address || null,
    },
  };
}

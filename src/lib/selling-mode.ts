// How a store sells, and every sentence that depends on it. A table store
// meets the buyer in a show hall; an online store confirms the order and gets
// in touch to arrange payment and pickup or delivery (no shipping or payment
// features). Pages read copy from here instead of branching on the mode.

export const SELLING_MODES = ["table", "online"] as const;
export type SellingMode = (typeof SELLING_MODES)[number];

/**
 * How long a sent cart holds stock. A buyer walks to a table in minutes; an
 * online seller may not see the order for hours.
 */
export const HOLD_MS: Record<SellingMode, number> = {
  table: 15 * 60_000,
  online: 24 * 60 * 60_000,
};

/** "+15 min" on the sale screen, for a buyer who went to the ATM. */
export const EXTEND_MIN = 15;
/** The most a buyer's hold can gain in all; request_hold_added_min checks it too. */
export const MAX_EXTEND_MIN = 60;

export const MODE_COPY = {
  table: {
    label: "At a table",
    hint: "You sell in person at card shows. Buyers send a cart, then come to your table to pay.",
    showTable: true,
    askPrice: "Ask at the table",
    askPriceLine: "Ask the seller for a price at the table.",
    noStock: "This store hasn't added stock yet. Ask at the table.",
    notVending: "Check back at their next show.",
    payNote: "You pay in whatever the seller accepts at the table.",
    cartTotal: "Total at the table",
    adjust: "The seller may adjust prices or add a discount when you meet.",
    nameHelp: "So the seller knows who to look for.",
    holdNote: "Items are held for you for 15 minutes.",
    sentNext:
      "Head to the table and show this screen. Your items are held for you.",
    codeLabel: "Show the seller this code",
    sentWord: "Request",
    declined:
      "Items are back in the store. You can talk to the seller at the table or send a new cart.",
    holdSoon: (table: string | null) =>
      table ? `Find the seller at table ${table}.` : "Find the seller soon.",
    signFact: "Pay at the table",
    floorTitle: "At your table",
    queueEmpty:
      "When a buyer scans your table sign and sends a cart, it lands here and your phone chimes. Stock your table first.",
  },
  online: {
    label: "Online store",
    hint: "Buyers order from your page. You confirm the order, then get in touch to arrange payment and pickup or delivery.",
    showTable: false,
    askPrice: "Ask the seller",
    askPriceLine: "Ask the seller for a price.",
    noStock: "This store hasn't added stock yet. Check back soon.",
    notVending: "Check back soon.",
    payNote: "You pay in whatever the seller accepts.",
    cartTotal: "Total",
    adjust: "The seller may adjust prices or add a discount when they confirm.",
    nameHelp: "So the seller knows who the order is from.",
    holdNote: "Items are held for you for 24 hours.",
    sentNext:
      "The seller will confirm your order and email you to arrange payment and pickup or delivery. Your items are held for you.",
    codeLabel: "Your order code",
    sentWord: "Order",
    declined: "Items are back in the store. You can send a new cart.",
    holdSoon: () => "The seller hasn't confirmed yet.",
    signFact: "Order on your phone",
    floorTitle: "On your page",
    queueEmpty:
      "When a buyer sends a cart from your store page, it lands here and your phone chimes. Add stock first.",
  },
} as const;

export const modeCopy = (mode: SellingMode) => MODE_COPY[mode];

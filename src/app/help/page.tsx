import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Help - tcgmart",
  description:
    "How to set up and run your tcgmart store: stock, pricing, selling online or at a table, carts, sales, buys and the ledger.",
};

const SECTIONS = [
  ["start", "Getting started"],
  ["stock", "Adding stock"],
  ["pricing", "Pricing"],
  ["selling", "Online or at a table"],
  ["open", "Opening and pausing"],
  ["carts", "Carts and sales"],
  ["quick", "Quick sales at the table"],
  ["buys", "Buying cards and trade-ins"],
  ["books", "Cash box, ledger and reports"],
  ["alerts", "Alerts"],
  ["faq", "Questions"],
] as const;

// Screenshots from e2e/help-shots.spec.ts (rerun it after a UI change).
const SHOT = {
  tips: [358, 829, "The Getting started checklist with two steps ticked"],
  "add-stock": [
    390,
    844,
    "Searching the catalog for Charizard, with market prices",
  ],
  pricing: [
    390,
    844,
    "Pricing settings: price rule, rounding and second currency",
  ],
  "how-you-sell": [
    390,
    844,
    "How you sell: at a table or online store, with a table number",
  ],
  "store-control": [358, 146, "The store switch: open, pause or not vending"],
  "buyer-store": [390, 844, "A store as a buyer sees it, with live prices"],
  "buyer-cart": [390, 844, "The buyer's cart with their name and email"],
  request: [
    390,
    844,
    "A cart arriving on the dashboard with Review sale and Decline",
  ],
  "confirm-sale": [
    390,
    844,
    "Reviewing a sale: prices, discount and how they paid",
  ],
  "quick-sale": [
    390,
    844,
    "Inventory with Sell buttons and the table sale bar",
  ],
  "cash-box": [
    358,
    383,
    "The cash box: float, cash sales, buys and what should be in the box",
  ],
  alerts: [390, 844, "Alert settings with sound and locked-phone alerts"],
} as const;

function Shots({ names }: { names: (keyof typeof SHOT)[] }) {
  return (
    <div className="my-2 flex flex-wrap gap-4">
      {names.map((n) => {
        const [w, h, alt] = SHOT[n];
        return (
          <figure key={n} className="w-[min(100%,15rem)]">
            <Image
              src={`/help/${n}.jpg`}
              width={w}
              height={h}
              alt={alt}
              sizes="15rem"
              className="h-auto w-full bg-[#090911] shadow-[0_0_0_1.5px_var(--border-strong)]"
            />
            <figcaption className="pt-1.5 text-sm">{alt}.</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

const link =
  "font-semibold text-foreground underline decoration-brand decoration-[1.5px] underline-offset-[5px]";

export default function HelpPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-4 py-2 md:px-14 md:py-6">
        <Wordmark />
      </header>
      <main className="paper mx-auto mb-16 w-full max-w-[72ch] flex-1 px-5 pt-10 pb-12 md:px-12">
        <article className="flex flex-col gap-4 text-muted-foreground [&_h2]:mt-6 [&_h2]:scroll-mt-6 [&_h2]:border-t-[1.5px] [&_h2]:border-text [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
          <h1 className="font-display text-[4rem] leading-[0.82] font-black text-foreground">
            Help
          </h1>
          <p>
            Everything you need to run your store, online or at a show. Signed
            in? Go to your{" "}
            <Link href="/dashboard" className={link}>
              dashboard
            </Link>
            .
          </p>
          <nav aria-label="On this page">
            <ul className="columns-1 gap-8 sm:columns-2">
              {SECTIONS.map(([id, title]) => (
                <li key={id}>
                  <a href={`#${id}`} className={link}>
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <h2 id="start">Getting started</h2>
          <ol>
            <li>
              Get an invite: enter your code on the Join page, or ask for one
              there. We email you a link to set up your account and choose a
              password. After that, sign in with your email and password.
            </li>
            <li>
              Name your store and pick its address (tcgmart.app/your-name). The
              address can&apos;t be changed later, so pick one you&apos;ll keep.
            </li>
            <li>Add your stock and set your price rule.</li>
            <li>Choose whether you sell online or at a table.</li>
            <li>Share your link or print your table sign, then open.</li>
          </ol>
          <p>
            Your dashboard shows a short checklist until you hide it. This page
            stays here for later.
          </p>

          <Shots names={["tips"]} />

          <h2 id="stock">Adding stock</h2>
          <p>
            Go to <strong>Inventory</strong> and add stock. Search the catalog
            by card name, set or number. Pick the card, then set condition,
            language, quantity and, for slabs, the grader and grade. Sealed
            product is in the catalog too.
          </p>
          <ul>
            <li>
              <strong>Can&apos;t find it?</strong> Add a custom item with your
              own name and price.
            </li>
            <li>
              <strong>Lots of stock?</strong> Import a CSV.{" "}
              <a href="/inventory-template.csv" className={link}>
                Download the template
              </a>
              , fill it in, and check the preview before you import.
            </li>
            <li>
              <strong>Cost:</strong> add what you paid for an item and the
              ledger works out your profit.
            </li>
            <li>Hide an item to keep it in your stock but off your store.</li>
          </ul>

          <Shots names={["add-stock"]} />

          <h2 id="pricing">Pricing</h2>
          <p>
            Cards are priced from the market as you add them and re-priced every
            night. Buyers see the price and 90 days of price history.
          </p>
          <ul>
            <li>
              <strong>Price rule:</strong> sell at a percentage of market, for
              example 90%.
            </li>
            <li>
              <strong>Rounding:</strong> round prices to a tidy step.
            </li>
            <li>
              <strong>Fixed price:</strong> set your own price on any item. It
              stays put when the market moves.
            </li>
            <li>
              <strong>Second currency:</strong> show buyers a second price at
              your own exchange rate.
            </li>
          </ul>
          <p>
            Change these under <strong>More → Pricing</strong>.
          </p>

          <Shots names={["pricing"]} />

          <h2 id="selling">Online or at a table</h2>
          <p>
            Under <strong>More → How you sell</strong>, pick one. It changes the
            words buyers see and how long their cart is held.
          </p>
          <ul>
            <li>
              <strong>At a table:</strong> buyers scan your QR sign, send a cart
              and come to your table to pay. Items are held for 15 minutes. Add
              your table number and print the sign.
            </li>
            <li>
              <strong>Online store:</strong> buyers order from your link. You
              confirm, then get in touch to arrange payment and pickup or
              delivery. Items are held for 24 hours. tcgmart doesn&apos;t take
              payments or ship.
            </li>
          </ul>
          <p>
            An online store can also let buyers choose at checkout. Under{" "}
            <strong>Online orders</strong>, turn on delivery, pickup, cash on
            delivery or at pickup, and bank transfer. Delivery asks the buyer
            for an address and phone; you book the courier (PickMe Flash, Uber
            parcel or your own). Buyers who choose bank transfer see your bank
            details after they order, with their order code as the reference.
            Confirm the sale once the money arrives. Add a note for couriers,
            areas, fees or where to pick up.
          </p>

          <Shots names={["how-you-sell"]} />

          <h2 id="open">Opening and pausing</h2>
          <p>The switch at the top of your dashboard sets what buyers get:</p>
          <ul>
            <li>
              <strong>Open:</strong> buyers can send carts.
            </li>
            <li>
              <strong>Paused:</strong> buyers can browse but not send. Pause for
              15 minutes, an hour, or until you reopen.
            </li>
            <li>
              <strong>Not vending:</strong> your page shows no stock or prices.
            </li>
          </ul>
          <p>
            A table store pauses itself 14 hours after you open, so nobody sends
            a cart after you&apos;ve gone home. Use{" "}
            <strong>Preview store</strong> to see your page exactly as buyers
            do.
          </p>

          <Shots names={["store-control"]} />

          <h2 id="carts">Carts and sales</h2>
          <ol>
            <li>
              A buyer fills a cart and sends it with their name and email. No
              account or app needed. The items are held so they can&apos;t be
              sold twice.
            </li>
            <li>
              It lands under <strong>Requests</strong> and your phone chimes.
            </li>
            <li>
              Open it, adjust prices or add a discount if you agreed one, and
              confirm the sale with how they paid. The buyer gets an emailed
              receipt.
            </li>
            <li>Not happening? Decline it and the items go back in stock.</li>
          </ol>
          <p>
            You also see how many people are on your store now, and carts while
            they&apos;re being built. Made a mistake? Open the sale under{" "}
            <strong>Sales</strong> and void it; the stock goes back.
          </p>

          <Shots
            names={["buyer-store", "buyer-cart", "request", "confirm-sale"]}
          />

          <h2 id="quick">Quick sales at the table</h2>
          <p>
            For walk-up buyers who don&apos;t want to use their phone, go to{" "}
            <strong>Inventory</strong> and tap <strong>Sell</strong> on each
            item. A table sale bar adds them up; tap{" "}
            <strong>Finish sale</strong>, pick how they paid and confirm. No
            email is needed and stock comes off as usual.
          </p>

          <Shots names={["quick-sale"]} />

          <h2 id="buys">Buying cards and trade-ins</h2>
          <p>
            Tap <strong>Buy</strong> in <strong>Inventory</strong> to record
            cards you buy or take in trade. They go into your stock, and the
            price you paid becomes their cost, so your profit stays right.
          </p>

          <h2 id="books">Cash box, ledger and reports</h2>
          <ul>
            <li>
              <strong>Cash box:</strong> start it with your float when you open.
              It adds cash sales and takes off cash paid for buys. At close,
              count your cash and compare it to what should be in the box.
            </li>
            <li>
              <strong>Ledger:</strong> takings, cost, profit, stock value and
              every stock change.
            </li>
            <li>
              <strong>Sales report:</strong> totals by day or weekend. Reports,
              the ledger and customers export as CSV.
            </li>
            <li>
              <strong>Customers:</strong> your buyers, and who agreed to promo
              emails.
            </li>
          </ul>

          <Shots names={["cash-box"]} />

          <h2 id="alerts">Alerts</h2>
          <p>
            Under <strong>More → Alerts</strong>, turn on sound and locked-phone
            alerts, then send a test alert. On an iPhone, locked-phone alerts
            need tcgmart on your home screen: tap Share, then Add to Home
            Screen, and open it from there.
          </p>

          <Shots names={["alerts"]} />

          <h2 id="faq">Questions</h2>
          <p>
            <strong>Do buyers need an account?</strong> No. They browse, fill a
            cart and send it.
          </p>
          <p>
            <strong>Does tcgmart take payment?</strong> No. Buyers pay you
            however you accept payment.
          </p>
          <p>
            <strong>A price looks wrong.</strong> Market prices update nightly.
            Set a fixed price on the item if you want your own.
          </p>
          <p>
            <strong>I forgot my password.</strong> Tap Forgot password on the
            sign-in page and we email you a link to set a new one. It works
            once, for an hour. Change it any time under More → Account.
          </p>
          <p>
            <strong>I have a new email.</strong> Under More → Account, enter the
            new address and your password. We email it a link; your sign-in
            email changes when you confirm it, and the old address is told.
          </p>
          <p>
            <strong>I want to close my account.</strong> Delete account under
            More → Account removes your store page, stock, sales and customer
            records for good. Export your Sales and Ledger first.
          </p>
          <p>
            Anything else, ask the person who invited you. See also the{" "}
            <Link href="/terms" className={link}>
              terms
            </Link>
            .
          </p>
        </article>
      </main>
    </div>
  );
}

import {
  BellRing,
  CalendarClock,
  BookOpen,
  CircleHelp,
  Flag,
  HandCoins,
  type LucideIcon,
  PackagePlus,
  Power,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { bento } from "@/components/bento";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Help - tcgmart",
  description:
    "How to set up and run your tcgmart store: stock, pricing, selling online or at a table, claim events, carts, sales, buys and the ledger.",
};

// Screenshots from e2e/help-shots.spec.ts (rerun it after a UI change).
const SHOT = {
  tips: [358, 829, "The Getting started checklist with two steps ticked"],
  "add-stock": [
    390,
    844,
    "Searching the catalog for Charizard, with market prices",
  ],
  pricing: [390, 844, "Pricing settings: price rule and rounding"],
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
type Shot = keyof typeof SHOT;

const SECTIONS: [id: string, title: string, icon: LucideIcon][] = [
  ["start", "Getting started", Flag],
  ["stock", "Adding stock", PackagePlus],
  ["pricing", "Pricing", Tag],
  ["selling", "Online or at a table", ShoppingBag],
  ["claims", "Claim events", CalendarClock],
  ["open", "Opening and pausing", Power],
  ["quick", "Quick sales at the table", Zap],
  ["carts", "Carts and sales", ShoppingCart],
  ["buys", "Buying cards and trade-ins", HandCoins],
  ["alerts", "Alerts", BellRing],
  ["books", "Cash box, ledger and reports", BookOpen],
  ["faq", "Questions", CircleHelp],
];

function Shots({ names }: { names: Shot[] }) {
  return (
    <div className="flex flex-wrap gap-4">
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

/**
 * One topic: a ruled tile on desktop. `wide` takes the whole row, with one
 * picture beside the text, or several below it.
 */
function Section(props: {
  id: string;
  wide?: boolean;
  shots?: Shot[];
  children: ReactNode;
}) {
  const [, title, Icon] = SECTIONS.find(([id]) => id === props.id)!;
  const beside = props.wide && props.shots?.length === 1;
  return (
    <section
      aria-labelledby={props.id}
      className={`flex flex-col gap-4 ${props.wide ? "lg:col-span-2" : ""}`}
    >
      <h2 id={props.id} className="flex items-center gap-2.5">
        <Icon aria-hidden className="size-5 shrink-0 stroke-[1.75]" />
        {title}
      </h2>
      <div
        className={
          beside
            ? "flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:items-start xl:gap-10"
            : "flex flex-col gap-4"
        }
      >
        <div className="flex max-w-[68ch] flex-col gap-4">{props.children}</div>
        {props.shots && <Shots names={props.shots} />}
      </div>
    </section>
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
      {/* Desktop: contents down the left, topics as ruled tiles on the right. */}
      <main className="paper mx-auto mb-16 w-full max-w-[72ch] flex-1 px-5 pt-10 pb-12 md:px-12 lg:grid lg:max-w-[1280px] lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-x-12">
        <div className="flex flex-col gap-4 text-muted-foreground lg:sticky lg:top-8">
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
            <ul className="columns-1 gap-8 sm:columns-2 lg:columns-1">
              {SECTIONS.map(([id, title, Icon]) => (
                <li key={id} className="py-0.5">
                  <a
                    href={`#${id}`}
                    className={`inline-flex items-center gap-2 ${link}`}
                  >
                    <Icon
                      aria-hidden
                      className="size-4 shrink-0 stroke-[1.75] text-muted-foreground"
                    />
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <article
          className={`mt-10 text-muted-foreground lg:mt-0 [&_h2]:scroll-mt-6 [&_h2]:border-t-[1.5px] [&_h2]:border-text [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground lg:[&_h2]:border-t-0 lg:[&_h2]:pt-0 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 ${bento}`}
        >
          <Section id="start" wide shots={["tips"]}>
            <ol>
              <li>
                Get an invite: enter your code on the Join page, or ask for one
                there. We email you a link to set up your account and choose a
                password. After that, sign in with your email and password.
              </li>
              <li>
                Name your store and pick its address (tcgmart.app/your-name).
                You can change it later under{" "}
                <strong>More → Store profile → Link</strong>; old links keep
                working and send buyers to the new one.
              </li>
            </ol>
            <p>
              Then your dashboard shows a short checklist, in this order, until
              you hide it:
            </p>
            <ol>
              <li>Add your stock.</li>
              <li>Choose whether you sell online or at a table.</li>
              <li>Set your price rule.</li>
              <li>
                Under <strong>More → Store profile</strong>, add a banner or a
                profile image. Buyers see them at the top of your store.
              </li>
              <li>Turn on alerts.</li>
              <li>Share your link, or print your table sign.</li>
              <li>Open your store.</li>
            </ol>
            <p>This page stays here for later.</p>
          </Section>

          <Section id="stock" wide shots={["add-stock"]}>
            <p>
              Go to <strong>Inventory</strong> and tap <strong>Add</strong>.
              Search the catalog by card name, set or number. Pick the card,
              then set condition, language, quantity and, for slabs, the grader
              and grade. Sealed product is in the catalog too.
            </p>
            <ul>
              <li>
                <strong>Can&apos;t find it, or not a card?</strong> Add a custom
                item with your own name and price. Pick <strong>Other</strong>{" "}
                for sleeves, toploaders, die-cast and other collectibles, with a
                category of your own; buyers filter them under Other. Add a
                photo from your phone when you add it, or later from{" "}
                <strong>Edit</strong>.
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
          </Section>

          <Section id="pricing" wide shots={["pricing"]}>
            <p>
              Cards are priced from the market as you add them and re-priced
              every night. On an item&apos;s page buyers see the price, its
              history (30 days, or 90 if they pick it) and recent market sales:
              how many copies sold each day, and for how much. Sealed product
              has no sales history.
            </p>
            <ul>
              <li>
                <strong>Price rule:</strong> sell under or over market by a
                percentage. Pick <strong>Under market</strong> or{" "}
                <strong>Over market</strong> and enter the percent; 0 matches
                market.
              </li>
              <li>
                <strong>Played cards:</strong> market prices are for Near Mint.
                A Lightly Played, Moderately Played, Heavily Played or Damaged
                single is priced at a share of it: 85%, 70%, 55% and 40% to
                start. Then your price rule and rounding apply.
              </li>
              <li>
                <strong>Rounding:</strong> round prices to a tidy step: exact
                cents, the nearest $0.50 or the nearest $1.
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
          </Section>

          <Section id="selling" wide shots={["how-you-sell"]}>
            <p>
              Under <strong>More → How you sell</strong>, pick one. It changes
              the words buyers see and how long their cart is held.
            </p>
            <ul>
              <li>
                <strong>At a table:</strong> buyers scan your QR sign, send a
                cart and come to your table to pay. Items are held for 15
                minutes. Add your table number and print the sign.
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
              Confirm the sale once the money arrives. Add your WhatsApp number
              and buyers get a button on their order to message you, for example
              with the transfer slip. Add a note for couriers, areas, fees or
              where to pick up. Addresses and phone numbers are cleared after 30
              days.
            </p>
          </Section>

          <Section id="claims">
            <p>
              An online store can run a timed claim sale. Under{" "}
              <strong>More → Claim events</strong>, tap{" "}
              <strong>New event</strong>, name it, start now or later, pick how
              long it runs and choose items from your stock. Use your store
              prices or set an event price per item.
            </p>
            <ul>
              <li>
                Share the link, for example to your WhatsApp group. Buyers join
                once with their name, WhatsApp number and email, then claim with
                one tap. They can join before it starts.
              </li>
              <li>
                The last one can only be claimed once. Set how many items one
                buyer can claim, and how many of each item, so nobody takes
                everything.
              </li>
              <li>
                Event items leave your store page until the end. It ends at the
                time you set or when everything is claimed. Whatever isn&apos;t
                claimed comes back to your store.
              </li>
              <li>
                Each buyer&apos;s claims show on the event page with a WhatsApp
                button. Once they pay, tap <strong>Mark as paid</strong> and
                confirm the sale; they get an email receipt. Claims not paid in
                the time you set go back to your store.
              </li>
              <li>
                <strong>Release</strong> gives a buyer&apos;s claims back (into
                the event while it runs). <strong>Block</strong> also stops
                their number and email joining your events again.
              </li>
            </ul>
          </Section>

          <Section id="open" shots={["store-control"]}>
            <p>The switch at the top of your dashboard sets what buyers get:</p>
            <ul>
              <li>
                <strong>Open:</strong> buyers can send carts.
              </li>
              <li>
                <strong>Paused:</strong> buyers can browse but not send. Pause
                for 15 minutes, an hour, or until you reopen.
              </li>
              <li>
                <strong>Not vending:</strong> your page shows no stock or
                prices.
              </li>
            </ul>
            <p>
              A table store pauses itself 14 hours after you open, so nobody
              sends a cart after you&apos;ve gone home. Use{" "}
              <strong>Preview store</strong> to see your page exactly as buyers
              do.
            </p>
          </Section>

          <Section id="quick" shots={["quick-sale"]}>
            <p>
              For walk-up buyers who don&apos;t want to use their phone, go to{" "}
              <strong>Inventory</strong> and tap <strong>Sell</strong> on each
              item. A table sale bar adds them up; tap{" "}
              <strong>Finish sale</strong>, pick how they paid and confirm. No
              email is needed and stock comes off as usual.
            </p>
          </Section>

          <Section
            id="carts"
            wide
            shots={["buyer-store", "buyer-cart", "request", "confirm-sale"]}
          >
            <ol>
              <li>
                A buyer fills a cart and sends it with their name and email
                (and, for delivery, a phone and address). No account or app
                needed. The items are held so they can&apos;t be sold twice.
              </li>
              <li>
                It lands under <strong>Requests</strong> on your dashboard and
                your phone chimes.
              </li>
              <li>
                Open it, adjust prices or add a discount if you agreed one, and
                confirm the sale with how they paid. The buyer gets an emailed
                receipt.
              </li>
              <li>Not happening? Decline it and the items go back in stock.</li>
            </ol>
            <p>
              You also see how many people are on your store now, and carts
              while they&apos;re being built. <strong>Sales</strong> lists
              today&apos;s sales and takings. Made a mistake? Open the sale and
              void it; the stock goes back and it leaves your totals.
            </p>
          </Section>

          <Section id="buys">
            <p>
              Tap <strong>Buy</strong> in <strong>Inventory</strong> to record
              cards you buy or take in trade. They go into your stock, and the
              price you paid becomes their cost, so your profit stays right.
              Cash you pay out comes off the cash box.
            </p>
          </Section>

          <Section id="alerts" shots={["alerts"]}>
            <p>
              Under <strong>More → Alerts</strong>, turn on sound and
              locked-phone alerts, then send a test alert. On an iPhone,
              locked-phone alerts need tcgmart on your home screen: tap Share,
              then Add to Home Screen, and open it from there.
            </p>
          </Section>

          <Section id="books" wide shots={["cash-box"]}>
            <ul>
              <li>
                <strong>Cash box:</strong> start it with your float when you
                open. It adds cash sales and takes off cash paid for buys. At
                close, tap <strong>Cash check</strong>, count your cash and
                compare it to what should be in the box.
              </li>
              <li>
                <strong>Ledger:</strong> takings, cost and profit for any days,
                what you bought, your cash checks, stock value and every stock
                change.
              </li>
              <li>
                <strong>Sales report:</strong> totals by day or weekend, how
                buyers paid and your best sellers.
              </li>
              <li>
                <strong>Customers:</strong> your buyers, and who agreed to promo
                emails. Remove a buyer when they ask.
              </li>
              <li>
                <strong>Exports:</strong> the sales report exports its sales,
                the ledger its buys, and Customers your promo list, all as CSV.
              </li>
            </ul>
          </Section>

          <Section id="faq" wide>
            <p>
              <strong>Do buyers need an account?</strong> No. They browse, fill
              a cart and send it.
            </p>
            <p>
              <strong>Does tcgmart take payment?</strong> No. Buyers pay you
              however you accept payment.
            </p>
            <p>
              <strong>A price looks wrong.</strong> Market prices update
              nightly. Set a fixed price on the item if you want your own.
            </p>
            <p>
              <strong>I forgot my password.</strong> Tap Forgot password on the
              sign-in page and we email you a link to set a new one. It works
              once, for an hour. Change it any time under More → Account.
            </p>
            <p>
              <strong>I have a new email.</strong> Under More → Account, enter
              the new address and your password. We email it a link; your
              sign-in email changes when you confirm it, and the old address is
              told.
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
          </Section>
        </article>
      </main>
    </div>
  );
}

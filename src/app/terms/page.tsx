import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Terms - shoptcg" };

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-4 py-2 md:px-14 md:py-6">
        <Wordmark />
      </header>
      {/* The terms are a printed handout: one sheet of paper on the hall. */}
      <main className="paper mx-auto mb-16 w-full max-w-[72ch] flex-1 px-5 pt-10 pb-12 md:px-12">
        <article className="flex flex-col gap-4 text-muted-foreground [&_h2]:mt-6 [&_h2]:border-t-[1.5px] [&_h2]:border-text [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground">
          <h1 className="font-display text-[4rem] leading-[0.82] font-black text-foreground">
            Terms
          </h1>
          <p>
            shoptcg is a hobby project run for a small group of card show
            vendors. It is provided as is, with no guarantee of uptime or
            accuracy. Prices shown are guides; the vendor at the table sets the
            final price.
          </p>
          <h2>What we collect</h2>
          <ul className="list-disc pl-6">
            <li>Vendors: your email address, used to sign you in.</li>
            <li>
              Buyers: your name and email, only when you send a request to a
              vendor, so they can confirm the sale and email your receipt.
            </li>
            <li>
              Promotions: only if you tick the optional box. You can unsubscribe
              from any promo email.
            </li>
          </ul>
          <h2>Browsing a store</h2>
          <p>
            While you are on a vendor&apos;s page, your browser keeps a random
            id for that store. It lets the vendor see how many people are
            looking and what is on your list before you send it, shown under a
            short tag like K7P. It holds no name, email or address, is not
            shared between stores, and visit records are deleted after 30 days.
          </p>
          <h2>Buyer requests</h2>
          <p>
            When you send a list, the vendor sees your name, your email and what
            you asked for, and the items are held for 15 minutes. If the request
            doesn&apos;t end in a sale, your details are deleted after 30 days.
            Promo emails are separate: they need the optional box, which starts
            unticked.
          </p>
          <h2>Store images</h2>
          <p>
            A vendor&apos;s banner and profile image are public and are kept
            with our file storage provider. Only upload images you have the
            right to use. We may remove any image.
          </p>
          <h2>What we do not do</h2>
          <p>We do not sell your data or share it with anyone else.</p>
          <h2>Payments</h2>
          <p>
            Payment happens in person between buyer and vendor. shoptcg never
            handles money.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about a purchase or your data go to the vendor you dealt
            with. They can ask us to delete your details.
          </p>
        </article>
      </main>
    </div>
  );
}

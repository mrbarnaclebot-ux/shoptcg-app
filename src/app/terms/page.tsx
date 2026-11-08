import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms - shoptcg" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <article className="flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold">
        <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
        <p>
          shoptcg is a hobby project run for a small group of card show vendors.
          It is provided as is, with no guarantee of uptime or accuracy. Prices
          shown are guides; the vendor at the table sets the final price.
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
  );
}

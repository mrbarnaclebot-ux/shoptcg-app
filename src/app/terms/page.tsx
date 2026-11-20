import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { TERMS_VERSION } from "@/lib/requests";

export const metadata: Metadata = { title: "Terms - tcgmart" };

// Each request stores the version its buyer agreed to, so the date can't drift.
const updated = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
}).format(new Date(`${TERMS_VERSION}T00:00:00Z`));

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
          <p className="text-sm">Last updated {updated}.</p>
          <p>
            tcgmart is a hobby project run for a small group of card vendors, at
            shows and online. It is provided as is, with no guarantee of uptime
            or accuracy. Prices shown are guides; the vendor sets the final
            price.
          </p>
          <h2>What we collect</h2>
          <ul className="list-disc pl-6">
            <li>
              Vendors: your email address and password, used to sign you in.
              Passwords are stored only as a one-way hash. An online store can
              add bank details, which buyers who pay by transfer see, and a
              WhatsApp number, which buyers see on their order.
            </li>
            <li>
              Asking for an invite: your name, email and what you tell us about
              how you sell, so we can reply.
            </li>
            <li>
              Buyers: your name and email, only when you send a request to a
              vendor, so they can confirm the sale and email your receipt; for
              delivery or pickup from an online store, your phone and, for
              delivery, your address; and your WhatsApp number when you join a
              claim event.
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
            looking and what is in your cart before you send it, shown under a
            short tag like K7P. It holds no name, email or address, is not
            shared between stores, and visit records are deleted after 30 days.
          </p>
          <h2>Buyer requests</h2>
          <p>
            When you send a cart, the vendor sees your name, your email, what
            you asked for and, at an online store, how you chose to get it and
            pay, with any phone and delivery address you gave. The items are
            held for 15 minutes (24 hours for an online store). If the request
            doesn&apos;t end in a sale, your details are deleted after 30 days.
            Your phone and address are deleted after 30 days either way. To
            limit how many requests one place can send, we keep a one-way hash
            of your network address with each request, deleted along with your
            name and email. Promo emails are separate: they need the optional
            box, which starts unticked.
          </p>
          <h2 id="claim-events">Claim events</h2>
          <p>
            To join a vendor&apos;s claim event you give your name, WhatsApp
            number and email. The vendor sees them with what you claimed, so
            they can message you on WhatsApp to arrange payment and email your
            receipt. Each claim holds the item until the vendor marks it paid,
            or until the time to pay after the event runs out. Joining runs a
            Cloudflare Turnstile check that you are a person, which Cloudflare
            processes under its own privacy policy. A vendor can release your
            claims or block your number and email from their events. Your phone
            number is deleted after 30 days, and your name and email too if
            nothing was sold.
          </p>
          <h2>Store images</h2>
          <p>
            A vendor&apos;s banner, profile image and item photos are public and
            are kept with Pinata, our file storage provider. Only upload images
            you have the right to use. We may remove any image.
          </p>
          <h2>What we do not do</h2>
          <p>
            We do not sell your data. Beyond the vendor you deal with, it goes
            only to the services that run tcgmart, listed below.
          </p>
          <h2>Services we use</h2>
          <ul className="list-disc pl-6">
            <li>
              Railway hosts the app and its database, where everything above is
              kept except images.
            </li>
            <li>
              Resend delivers our emails: sign-in and account emails, invite
              replies and receipts. It gets the address and the message, which
              for a receipt includes your name and what you bought.
            </li>
            <li>Pinata stores the images vendors upload.</li>
            <li>
              Sentry gets a report when something breaks: the error, the page
              and the browser. We send it no names, emails or other personal
              details.
            </li>
            <li>
              Cloudflare Turnstile checks claim-event joins. It gets your IP
              address and what its check reads from your browser.
            </li>
          </ul>
          <h2>Payments</h2>
          <p>
            tcgmart never takes, holds or sends money. At a table you pay the
            vendor in person. An online store arranges payment and delivery or
            pickup with you, for example cash on delivery or at pickup, or a
            bank transfer to the account the vendor shows you after you order.
            The vendor books any courier; tcgmart doesn&apos;t ship.
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

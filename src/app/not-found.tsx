import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { getPublicStore, MISSING_HEADER, type Missing } from "@/lib/storefront";

const SAYS: Record<Missing, [title: string, hint: string]> = {
  store: ["We can't find that store.", "Check the link on the table sign."],
  item: [
    "We can't find that item.",
    "The seller may have taken it off their store.",
  ],
  claim: [
    "We can't find that claim event.",
    "Check the link the seller shared.",
  ],
  request: [
    "We can't find that request.",
    "Open it on the phone you sent it from.",
  ],
};

// src/proxy.ts sends most 404s here, with the real status, and says in a
// request header what was missing. Anything else gets the plain page.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-5 px-4 pt-12 md:px-6 lg:px-8">
        <Suspense>
          <Says />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}

async function Says() {
  const [what, slug] = ((await headers()).get(MISSING_HEADER) ?? "").split(" ");
  const known = Object.hasOwn(SAYS, what) ? (what as Missing) : null;
  // The header only words the page; the store is looked up, not trusted.
  const store =
    known && known !== "store" && slug
      ? await getPublicStore(getDb(), slug).catch(() => null)
      : null;
  const [title, hint] =
    known && (store || known === "store")
      ? SAYS[known]
      : ["We can't find that page.", null];
  return (
    <>
      <h1 className="font-display text-3xl font-black md:text-[4rem]">
        {title}
      </h1>
      {hint && (
        <p className="max-w-[44ch] text-lg text-muted-foreground">{hint}</p>
      )}
      {store ? (
        <Link href={`/${store.slug}`} className={lineButton}>
          Back to {store.name}
        </Link>
      ) : (
        <Link href="/" className={lineButton}>
          Go to tcgmart.app
        </Link>
      )}
    </>
  );
}

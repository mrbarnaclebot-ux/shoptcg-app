import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { appUrl } from "@/lib/deployed";
import { modeCopy } from "@/lib/selling-mode";
import { requireStore } from "@/lib/session";
import { BackToMore } from "../back-to-more";
import { PrintButton } from "./print-button";
import "./sign.css";
import { TableSign, type SignSize } from "./table-sign";

export const metadata: Metadata = { title: "Table sign - tcgmart" };

// Printed signs are permanent, so the source tag is baked in now even though
// nothing reads it yet.
function storeUrl(slug: string, src: "sign" | "nfc") {
  const origin = appUrl();
  return {
    url: `${origin.origin}/${slug}?src=${src}`,
    shown: `${origin.host}/${slug}`,
  };
}

export default function SignPage({
  searchParams,
}: PageProps<"/dashboard/sign">) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-4 pt-4 pb-16 md:px-6 lg:px-8">
      <BackToMore />
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Table sign
      </h1>
      <Suspense
        fallback={<div className="h-[600px] animate-pulse bg-surface" />}
      >
        <Sign searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Sign({
  searchParams,
}: Pick<PageProps<"/dashboard/sign">, "searchParams">) {
  const { store } = await requireStore();
  const size: SignSize = (await searchParams).size === "a4" ? "a4" : "a5";
  const sign = storeUrl(store.slug, "sign");
  const copy = modeCopy(store.sellingMode);
  const nfc = storeUrl(store.slug, "nfc");
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[auto_1fr]">
      {/* @page cannot depend on a class, so the chosen size is written per render. */}
      <style>{`@page { size: ${size.toUpperCase()} portrait; margin: 0 }`}</style>
      <div className="max-w-full overflow-hidden">
        <div className="origin-top-left max-md:[zoom:0.6] md:max-lg:[zoom:0.85] print:[zoom:1]">
          <TableSign
            size={size}
            name={store.name}
            url={sign.url}
            shownUrl={sign.shown}
            tableLabel={copy.showTable ? store.tableLabel : null}
            nfc={store.nfcEnabled}
            fact={copy.signFact}
          />
        </div>
      </div>
      <div className="flex max-w-md flex-col gap-8">
        <nav aria-label="Paper size" className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Paper size</span>
          <div className="flex gap-2">
            {(["a5", "a4"] as const).map((s) => (
              <Link
                key={s}
                href={`/dashboard/sign?size=${s}`}
                replace
                scroll={false}
                aria-current={s === size ? "true" : undefined}
                className="grid min-h-11 min-w-14 place-items-center px-3.5 font-medium text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] aria-[current=true]:bg-text aria-[current=true]:font-semibold aria-[current=true]:text-bg"
              >
                {s.toUpperCase()}
              </Link>
            ))}
          </div>
        </nav>
        {/* Edited under How you sell only, so both save the same way. */}
        <dl className="flex flex-col gap-3 text-sm">
          {copy.showTable && (
            <div className="flex flex-col gap-1">
              <dt className="font-semibold">Table number</dt>
              <dd className="text-muted-foreground">
                {store.tableLabel ? (
                  <span className="num font-semibold text-text">
                    {store.tableLabel}
                  </span>
                ) : (
                  "None on the sign."
                )}
              </dd>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <dt className="font-semibold">NFC tag</dt>
            <dd className="text-muted-foreground">
              {store.nfcEnabled ? (
                <>
                  The sign says &quot;Or tap your phone here&quot;. Write this
                  link to an NTAG215 tag and stick it by that line:{" "}
                  <span className="num font-semibold break-all text-text">
                    {nfc.url}
                  </span>
                </>
              ) : (
                "No NFC line on the sign."
              )}
            </dd>
          </div>
        </dl>
        <Link
          href="/dashboard/settings/table"
          className="-mt-6 inline-flex min-h-11 items-center self-start font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          Edit {copy.showTable ? "table number and NFC" : "NFC"}
        </Link>
        <div className="flex flex-col items-start gap-3">
          <PrintButton />
          <p className="text-sm text-muted-foreground">
            Print at 100% (actual size). The QR scans from about a metre away.
          </p>
        </div>
      </div>
    </div>
  );
}

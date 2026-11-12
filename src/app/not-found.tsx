import Link from "next/link";
import { lineButton } from "@/components/ticket-button";

export default function StoreNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-start gap-5 px-4 pt-16 md:px-6 lg:px-8">
      <h1 className="font-display text-[2.5rem] leading-[0.9] font-black md:text-[4rem]">
        We can&apos;t find that store.
      </h1>
      <p className="max-w-[44ch] text-lg text-muted-foreground">
        Check the link on the table sign.
      </p>
      <Link href="/" className={lineButton}>
        Go to tcgmart.app
      </Link>
    </main>
  );
}

import Link from "next/link";
import { lineButton } from "@/components/ticket-button";

export default function DashboardNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-5 px-4 pt-16">
      <h1 className="font-display text-[3rem] leading-[0.9] font-black">
        We can&apos;t find that.
      </h1>
      <Link href="/dashboard" className={lineButton}>
        Back to requests
      </Link>
    </main>
  );
}

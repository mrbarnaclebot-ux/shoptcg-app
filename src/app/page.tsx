import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Placeholder: the Designer owns the real landing page.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">shoptcg</h1>
      <p className="text-muted-foreground">
        Live-priced Pokemon TCG stock for card show vendors. Buyers scan your
        table QR code and see your prices on their phone.
      </p>
      <div>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Vendor sign in
        </Link>
      </div>
    </main>
  );
}

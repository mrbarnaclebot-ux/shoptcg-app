import Link from "next/link";

// Brand wordmark: plain Archivo expanded 800, ".app" in muted (UI-SPEC section 9).
export function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center text-lg font-extrabold wdth-118"
    >
      shoptcg<span className="text-muted-foreground">.app</span>
    </Link>
  );
}

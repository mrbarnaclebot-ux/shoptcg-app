import Link from "next/link";

// Wordmark in the poster face; the dot is the one lamp-lit character.
export function Wordmark() {
  return (
    <Link
      href="/"
      className="font-display inline-flex min-h-11 items-center text-[1.625rem] leading-none font-extrabold tracking-[0.01em]"
    >
      tcgmart<span className="text-brand">.</span>app
    </Link>
  );
}

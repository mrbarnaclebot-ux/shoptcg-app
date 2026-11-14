import Link from "next/link";

// Wordmark in the poster face; the dot is the one lamp-lit character.
// Inside the dashboard it leads back to the dashboard, not the landing page.
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      // The coloured dot is its own span; screen readers said "tcgmart . app".
      aria-label="tcgmart.app"
      className="font-display inline-flex min-h-11 items-center text-[1.625rem] leading-none font-extrabold tracking-[0.01em]"
    >
      tcgmart<span className="text-brand">.</span>app
    </Link>
  );
}

import type { Metadata } from "next";
import { AccountBlock } from "./account-block";

export const metadata: Metadata = { title: "More - tcgmart" };

// A phone sees only the menu from the layout. The desk's More tab opens Store
// profile; this bare URL shows the account there, so old links still work.
export default function MorePage() {
  return <AccountBlock className="hidden lg:flex" />;
}

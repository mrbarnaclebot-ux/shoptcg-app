import type { Metadata } from "next";
import { AccountBlock } from "../account-block";

export const metadata: Metadata = { title: "Account - tcgmart" };

export default function AccountPage() {
  return <AccountBlock />;
}

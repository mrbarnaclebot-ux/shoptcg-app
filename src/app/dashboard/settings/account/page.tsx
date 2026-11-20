import type { Metadata } from "next";
import { AccountBlock } from "../account-block";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return <AccountBlock />;
}

import type { Metadata } from "next";
import { ToastRoot } from "@/components/toast-root";
import { JoinPage } from "../join-page";

// The code comes from the URL, so this page renders per request.
export const instant = false;

export const metadata: Metadata = {
  title: "Join - shoptcg",
  robots: { index: false },
};

// Only fills the form: nothing is checked until it's sent, so opening the
// link tells a scanner nothing and spends nothing.
export default async function JoinWithCode({
  params,
}: PageProps<"/join/[code]">) {
  const { code } = await params;
  return (
    <ToastRoot>
      <JoinPage code={decodeURIComponent(code).slice(0, 64)} />
    </ToastRoot>
  );
}

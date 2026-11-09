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
  let typed = code;
  try {
    typed = decodeURIComponent(code);
  } catch {
    // A malformed escape: show it as typed, and the check says it's wrong.
  }
  return (
    <ToastRoot>
      <JoinPage code={typed.slice(0, 64)} />
    </ToastRoot>
  );
}

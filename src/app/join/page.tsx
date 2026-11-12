import type { Metadata } from "next";
import { ToastRoot } from "@/components/toast-root";
import { JoinPage } from "./join-page";

export const metadata: Metadata = {
  title: "Join - tcgmart",
  robots: { index: false },
};

export default function Join() {
  return (
    <ToastRoot>
      <JoinPage />
    </ToastRoot>
  );
}

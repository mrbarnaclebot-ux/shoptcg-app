import type { ReactNode } from "react";
import { ToastRoot } from "@/components/toast-root";

// The one buyer route with toasts: the store and list pages stay light.
export default function RequestLayout({ children }: { children: ReactNode }) {
  return <ToastRoot>{children}</ToastRoot>;
}

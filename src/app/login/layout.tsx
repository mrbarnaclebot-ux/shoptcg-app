import { ToastRoot } from "@/components/toast-root";

// Toasts (Sileo, motion) ship only where they fire: login and the dashboard.
export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return <ToastRoot>{children}</ToastRoot>;
}

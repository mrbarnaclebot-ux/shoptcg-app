import { Suspense } from "react";
import { ToastRoot } from "@/components/toast-root";
import { Wordmark } from "@/components/wordmark";
import { DashboardNav } from "./nav";
import { TimeZoneCookie } from "./time-zone-cookie";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <ToastRoot>
      <TimeZoneCookie />
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* usePathname is request data on [id] routes, so the nav streams there. */}
        <Suspense fallback={<div className="hidden lg:block lg:w-24" />}>
          <DashboardNav />
        </Suspense>
        {/* The rail border lives here: this column spans the whole page, the sticky rail only the viewport. */}
        <div className="flex min-w-0 flex-1 flex-col border-border pb-24 lg:border-l lg:pb-0">
          <header className="border-b border-border">
            <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center px-4 md:px-6 lg:h-20 lg:px-8">
              <Wordmark href="/dashboard" />
            </div>
          </header>
          {children}
        </div>
      </div>
    </ToastRoot>
  );
}

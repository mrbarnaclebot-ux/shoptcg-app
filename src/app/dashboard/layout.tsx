import { Suspense } from "react";
import { ToastRoot } from "@/components/toast-root";
import { Wordmark } from "@/components/wordmark";
import { getDb } from "@/db";
import { waitingCount } from "@/lib/request-reads";
import { storeOrNull } from "@/lib/session";
import { DashboardNav } from "./nav";
import { PendingSync } from "./pending-sales";
import { StoreLive } from "./store-live";
import { TimeZoneCookie } from "./time-zone-cookie";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <ToastRoot>
      <TimeZoneCookie />
      <Suspense>
        <Alerts />
      </Suspense>
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* usePathname is request data on [id] routes, so the nav streams there. */}
        <Suspense fallback={<div className="hidden lg:block lg:w-24" />}>
          <DashboardNav />
        </Suspense>
        {/* The rail border lives here: this column spans the whole page, the sticky rail only the viewport. */}
        <div className="flex min-w-0 flex-1 flex-col border-border pb-[calc(6rem+env(safe-area-inset-bottom))] lg:border-l lg:pb-0">
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

/**
 * The store's live stream for every dashboard page. A layout keeps its state
 * across navigations, and the stream's re-reads refresh this count with the
 * page. Test requests count: the vendor sends one to hear the chime. Sales
 * saved on the phone while offline send from here too, whatever the page.
 */
async function Alerts() {
  const store = await storeOrNull();
  if (!store) return null;
  const waiting = await waitingCount(getDb(), store.id, { tests: true });
  return (
    <>
      <StoreLive waiting={waiting} />
      <PendingSync />
    </>
  );
}

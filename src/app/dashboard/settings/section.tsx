import { Suspense, type ReactNode } from "react";

/** A settings page: the poster title, then its content once the store has loaded. */
export function SettingsPage(props: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-black">{props.title}</h1>
      <Suspense fallback={<div className="h-80 animate-pulse bg-surface" />}>
        {props.children}
      </Suspense>
    </main>
  );
}

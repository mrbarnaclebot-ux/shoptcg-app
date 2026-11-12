"use client";

import { cn } from "cn";
import { useState, type MouseEvent, type ReactNode } from "react";
import { lineButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";

/** A plain download link that, with JS, says how many rows came down. */
export function ExportButton(props: {
  href: string;
  /** What one row of the file is, for the toast's count. */
  unit: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const cls = cn(lineButton, props.className);
  if (props.disabled)
    return (
      <button type="button" disabled className={cls}>
        {props.children}
      </button>
    );
  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(props.href);
      if (res.status === 429) return toast.exportLimited();
      // A lost session redirects to the login page: a 200 with no count.
      const rows = res.headers.get("X-Row-Count");
      if (!res.ok || rows === null) throw new Error(String(res.status));
      const file = /filename="([^"]+)"/.exec(
        res.headers.get("Content-Disposition") ?? "",
      )?.[1];
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = file ?? "tcgmart.csv";
      a.click();
      // Some mobile browsers read the blob after click() returns.
      setTimeout(() => URL.revokeObjectURL(url), 40_000);
      toast.exported(a.download, Number(rows), props.unit);
    } catch {
      toast.exportFailed(run);
    } finally {
      setBusy(false);
    }
  };
  const click = (e: MouseEvent) => {
    e.preventDefault();
    if (!busy) void run();
  };
  return (
    <a
      href={props.href}
      download
      onClick={click}
      aria-busy={busy}
      className={cls}
    >
      {busy ? "Exporting" : props.children}
    </a>
  );
}

"use client";

import { CircleAlert, Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { PreviewRow } from "@/lib/csv-import";
import { importCsvAction, previewCsvAction } from "../actions";
import { PreviewTable } from "./preview-table";

// Server actions reject bodies over 1 MB with an opaque error; stop short of it here.
const MAX_FILE_BYTES = 900_000;
const FAILED =
  "Couldn't reach the server. Check your connection and try again.";

export function ImportFlow() {
  const router = useRouter();
  const [rows, setRows] = useState<PreviewRow[]>();
  const [error, setError] = useState<string>();
  const [checking, startCheck] = useTransition();
  const [importing, startImport] = useTransition();
  const valid = rows?.flatMap((r) => (r.row ? [r.row] : [])) ?? [];

  const choose = (file: File | undefined) =>
    file &&
    startCheck(async () => {
      setRows(undefined);
      if (file.size > MAX_FILE_BYTES)
        return setError(
          "That file is too big. Keep it under 900 KB, or split it.",
        );
      try {
        const res = await previewCsvAction(await file.text());
        setError(res.error);
        setRows(res.rows);
      } catch {
        setError(FAILED);
      }
    });
  const confirm = () =>
    startImport(async () => {
      try {
        const res = await importCsvAction(valid);
        if (res.error) return setError(res.error);
      } catch {
        return setError(FAILED);
      }
      router.push("/dashboard/inventory");
    });

  return (
    <div className="flex flex-col gap-4">
      <FilePicker
        again={Boolean(rows)}
        disabled={checking || importing}
        onFile={choose}
      />
      {checking && (
        <p role="status" className="text-muted-foreground">
          Checking your rows against the catalog. Big files take a minute.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="flex gap-2 rounded-md bg-danger-bg px-4 py-3 text-danger"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}
      {rows && <PreviewTable rows={rows} />}
      {rows && (
        <Button
          size="lg"
          className="self-start"
          disabled={!valid.length || importing}
          aria-busy={importing}
          onClick={confirm}
        >
          {importing
            ? "Importing"
            : `Import ${valid.length} ${valid.length === 1 ? "item" : "items"}`}
        </Button>
      )}
    </div>
  );
}

function FilePicker(props: {
  again: boolean;
  disabled: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-md bg-brand px-5 font-bold text-on-brand has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2">
        <Upload aria-hidden className="size-5" />
        {props.again ? "Choose another file" : "Choose CSV file"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={props.disabled}
          onChange={(e) => props.onFile(e.target.files?.[0])}
        />
      </label>
      <a
        href="/inventory-template.csv"
        download
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-text"
      >
        <Download aria-hidden className="size-4" />
        CSV template
      </a>
    </div>
  );
}

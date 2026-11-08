"use client";

import { CircleAlert, Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LabeledProgressIndicator } from "@/components/labeled-progress-indicator";
import { Button } from "@/components/ui/button";
import type { PreviewRow } from "@/lib/csv-import";
import { toast, type ImportSummary } from "@/lib/toast";
import { importCsvAction, previewCsvAction } from "../actions";
import { needsPrice, PreviewTable } from "./preview-table";

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

  const fail = (why: string) => {
    setError(why);
    toast.csvUnreadable(why);
  };
  const choose = (file: File | undefined) =>
    file &&
    startCheck(async () => {
      setRows(undefined);
      setError(undefined);
      if (file.size > MAX_FILE_BYTES)
        return fail("That file is too big. Keep it under 900 KB, or split it.");
      try {
        const res = await previewCsvAction(await file.text());
        if (res.error) fail(res.error);
        setRows(res.rows);
      } catch {
        // The file may be fine; the request never landed.
        setError(FAILED);
        toast.sendFailed(FAILED);
      }
    });
  const confirm = () =>
    startImport(async () => {
      try {
        await toast.importCsv(valid.length, runImport(valid, rows!));
      } catch (err) {
        return setError((err as Error).message);
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
        <LabeledProgressIndicator
          label="Checking your CSV"
          steps={[
            "Reading rows",
            "Matching the catalog",
            "Looking up new cards",
            "Big files take a minute",
          ]}
        />
      )}
      {error && (
        <p className="flex gap-2 rounded-sm bg-danger-bg px-4 py-3 text-danger">
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

// Rejects with a user-safe message so the toast and the inline error agree.
async function runImport(
  valid: NonNullable<PreviewRow["row"]>[],
  rows: PreviewRow[],
): Promise<ImportSummary> {
  const res: { count?: number; error?: string } = await importCsvAction(
    valid,
  ).catch(() => ({ error: FAILED }));
  if (res.error) throw new Error(res.error);
  return {
    count: res.count ?? 0,
    unpriced: rows.filter(needsPrice).length,
    rejected: rows.filter((r) => r.status === "error").map((r) => r.line),
  };
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

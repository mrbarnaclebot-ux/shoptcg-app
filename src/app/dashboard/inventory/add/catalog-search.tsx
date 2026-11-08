"use client";

import { CircleAlert, Search } from "lucide-react";
import { useRef, useState } from "react";
import { CardThumb } from "@/components/card-thumb";
import { Input } from "@/components/ui/input";
import type { CatalogItem } from "@/db/schema";
import { toast } from "@/lib/toast";
import { searchCatalogAction } from "../../catalog-actions";
import { AddPanel } from "./add-panel";
import { Segmented } from "@/components/segmented";

type Kind = "raw" | "graded" | "sealed";
type Lang = "en" | "ja";
type Status = "idle" | "loading" | "done";

const DEBOUNCE_MS = 400;

function useCatalogSearch() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);
  const run = async (
    query: string,
    kind: Kind,
    language: Lang,
    force = false,
  ) => {
    const id = ++latest.current;
    setStatus("loading");
    try {
      const res = await searchCatalogAction({ query, kind, language, force });
      // A slower earlier search must not overwrite a newer one.
      if (id !== latest.current) return;
      setItems(res.items);
      setError(res.error);
      if (res.limit) toast.searchLimit(res.limit);
    } catch {
      if (id === latest.current) setError("Search failed. Try again.");
    }
    if (id === latest.current) setStatus("done");
  };
  const schedule = (query: string, kind: Kind, language: Lang) => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) {
      latest.current++;
      setStatus("idle");
      setItems([]);
      setError(undefined);
      return;
    }
    timer.current = setTimeout(() => run(query, kind, language), DEBOUNCE_MS);
  };
  return { items, error, status, run, schedule };
}

export function CatalogSearch({ onCustom }: { onCustom: () => void }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("raw");
  const [language, setLanguage] = useState<Lang>("en");
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  const search = useCatalogSearch();
  const change = (q: string, k = kind, l = language) => {
    setPicked(null);
    search.schedule(q, k, l);
  };
  if (picked) return <AddPanel item={picked} onClose={() => setPicked(null)} />;
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Type"
        value={kind}
        options={[
          ["raw", "Raw"],
          ["graded", "Graded"],
          ["sealed", "Sealed"],
        ]}
        onChange={(k) => {
          setKind(k);
          change(query, k);
        }}
      />
      <Segmented
        label="Language"
        value={language}
        options={[
          ["en", "English"],
          ["ja", "Japanese"],
        ]}
        onChange={(l) => {
          setLanguage(l);
          change(query, kind, l);
        }}
      />
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-subtle"
        />
        <Input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            change(e.target.value);
          }}
          placeholder="Name or number, e.g. charizard 199"
          aria-label="Search the catalog"
          className="pl-11"
        />
      </div>
      <Results
        {...search}
        onPick={setPicked}
        onMore={() => search.run(query, kind, language, true)}
        onCustom={onCustom}
      />
    </div>
  );
}

function Results(props: {
  items: CatalogItem[];
  error?: string;
  status: Status;
  onPick: (item: CatalogItem) => void;
  onMore: () => void;
  onCustom: () => void;
}) {
  const { items, error, status } = props;
  if (status === "idle") return null;
  return (
    <div
      aria-live="polite"
      aria-busy={status === "loading"}
      className="flex flex-col gap-3"
    >
      {error && (
        <p className="flex gap-2 rounded-md bg-warning-bg px-4 py-3 text-sm text-warning">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      {status === "loading" && !items.length && (
        <p className="text-sm text-subtle">Searching</p>
      )}
      {status === "done" && !items.length && !error && (
        <p className="text-muted-foreground">
          No cards found. Check the spelling or number.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {items.map((it) => (
          <ResultItem key={it.id} item={it} onPick={props.onPick} />
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-4">
        {status === "done" && !error && (
          <button
            type="button"
            onClick={props.onMore}
            className="min-h-11 text-sm font-semibold text-brand-text"
          >
            Not here? Search more
          </button>
        )}
        <button
          type="button"
          onClick={props.onCustom}
          className="min-h-11 text-sm font-semibold text-brand-text"
        >
          Add a custom item instead
        </button>
      </div>
    </div>
  );
}

function ResultItem({
  item,
  onPick,
}: {
  item: CatalogItem;
  onPick: (item: CatalogItem) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(item)}
        className="flex w-full items-center gap-3 py-2 text-left hover:bg-surface"
      >
        <CardThumb
          src={item.imageUrl}
          kind={item.kind}
          language={item.language}
          className="w-12"
        />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{item.name}</span>
          <span className="text-sm text-muted-foreground">
            {[
              item.setName,
              item.number,
              item.grader && `${item.grader} ${item.grade}`,
            ]
              .filter(Boolean)
              .join(" ")}
          </span>
        </span>
      </button>
    </li>
  );
}

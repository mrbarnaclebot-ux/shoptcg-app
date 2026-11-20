"use client";

import { CircleAlert, Search } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { CardThumb } from "@/components/card-thumb";
import { Segmented } from "@/components/segmented";
import { Input } from "@/components/ui/input";
import type { SearchFailure, SearchItem } from "@/lib/catalog";
import { usd } from "@/lib/format";
import { toast } from "@/lib/toast";
import { AddPanel } from "./add-panel";

type Kind = "raw" | "graded" | "sealed";
type Lang = "en" | "ja";
// loading: nothing to show yet. more: cached rows shown, the provider is asked.
type Status = "idle" | "loading" | "more" | "done";
type Problem = SearchFailure | "offline" | "failed";

// The cached answer is cheap, so it comes quickly; the provider is asked
// only once typing has paused a while longer, since each ask costs a lookup.
const CACHED_MS = 150;
const FRESH_MS = 450;
const SKELETONS = 3;

const ONLY_CACHED = "so only cards already in the catalog show.";
const PROBLEM: Record<Problem, string> = {
  busy: `Card lookup is busy right now, ${ONLY_CACHED}`,
  limit: `This hour's card lookups are used up, ${ONLY_CACHED}`,
  down: `Card lookup isn't answering, ${ONLY_CACHED}`,
  offline: "You're offline. Check the connection and try again.",
  failed: "Search failed. Try again.",
};

async function post(body: object, signal: AbortSignal) {
  const res = await fetch("/api/catalog-search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()) as {
    items?: SearchItem[];
    answered?: boolean;
    failure?: SearchFailure;
    limit?: number;
  };
}

function useCatalogSearch() {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [problem, setProblem] = useState<Problem>();
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);
  const abort = useRef<AbortController>(undefined);
  const run = async (query: string, kind: Kind, language: Lang) => {
    const id = ++latest.current;
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    // A slower earlier search must not overwrite a newer one.
    const stale = () => id !== latest.current;
    setStatus("loading");
    setProblem(undefined);
    const body = { query, kind, language };
    try {
      const cached = await post({ ...body, phase: "cached" }, ctl.signal);
      if (stale()) return;
      setItems(cached.items ?? []);
      if (cached.answered) return setStatus("done");
      setStatus("more");
      await new Promise((r) => setTimeout(r, FRESH_MS - CACHED_MS));
      if (stale()) return;
      const fresh = await post({ ...body, phase: "fresh" }, ctl.signal);
      if (stale()) return;
      if (fresh.failure) setProblem(fresh.failure);
      else setItems(fresh.items ?? []);
      if (fresh.limit) toast.searchLimit(fresh.limit);
    } catch {
      if (stale()) return;
      setProblem(navigator.onLine ? "failed" : "offline");
    }
    setStatus("done");
  };
  const schedule = (query: string, kind: Kind, language: Lang) => {
    clearTimeout(timer.current);
    // Any keystroke retires the search in flight.
    latest.current++;
    if (query.trim().length < 2) {
      abort.current?.abort();
      setStatus("idle");
      setItems([]);
      setProblem(undefined);
      return;
    }
    // Placeholders straight away, so a keystroke never looks ignored.
    setStatus((s) => (s === "idle" ? "loading" : s));
    timer.current = setTimeout(() => run(query, kind, language), CACHED_MS);
  };
  return { items, problem, status, run, schedule };
}

// The last Type and Language picked, so a vendor listing JP slabs all
// afternoon doesn't re-pick them each time.
const PREFS_KEY = "tcgmart:add-search";
const noop = () => () => {};
function readPrefs() {
  try {
    return localStorage.getItem(PREFS_KEY);
  } catch {
    return null;
  }
}
function parsePrefs(raw: string | null): { kind?: Kind; language?: Lang } {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function savePrefs(kind: Kind, language: Lang) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ kind, language }));
  } catch {}
}

export function CatalogSearch() {
  const [query, setQuery] = useState("");
  const saved = parsePrefs(useSyncExternalStore(noop, readPrefs, () => null));
  const [picked, setPicked] = useState<{ kind?: Kind; language?: Lang }>({});
  const kind = picked.kind ?? saved.kind ?? "raw";
  const language = picked.language ?? saved.language ?? "en";
  const [item, setItem] = useState<SearchItem | null>(null);
  const search = useCatalogSearch();
  const choose = (k: Kind, l: Lang) => {
    setPicked({ kind: k, language: l });
    savePrefs(k, l);
    setItem(null);
    search.schedule(query, k, l);
  };
  if (item)
    return (
      <AddPanel
        item={item}
        graded={kind === "graded"}
        onClose={() => setItem(null)}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search.schedule(e.target.value, kind, language);
          }}
          onKeyDown={(e) => {
            // Enter takes the top result, as a scanner-style workflow expects.
            if (
              e.key === "Enter" &&
              search.items[0] &&
              search.status !== "idle"
            )
              setItem(search.items[0]);
          }}
          enterKeyHint="go"
          placeholder="Name, set or number, e.g. charizard 199"
          aria-label="Search the catalog"
          className="pl-11"
        />
      </div>
      {/* Vendors type first; type and language sit under the box on one row. */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Segmented
          label="Type"
          value={kind}
          options={[
            ["raw", "Raw"],
            ["graded", "Graded"],
            ["sealed", "Sealed"],
          ]}
          onChange={(k) => choose(k, language)}
        />
        <Segmented
          label="Language"
          value={language}
          options={[
            ["en", "EN"],
            ["ja", "JP"],
          ]}
          onChange={(l) => choose(kind, l)}
        />
      </div>
      <Results
        {...search}
        onPick={setItem}
        onRetry={() => search.run(query, kind, language)}
      />
    </div>
  );
}

function Results(props: {
  items: SearchItem[];
  problem?: Problem;
  status: Status;
  onPick: (item: SearchItem) => void;
  onRetry: () => void;
}) {
  const { items, problem, status } = props;
  if (status === "idle") return null;
  const waiting = status === "loading" || status === "more";
  // Placeholders hold the space results will take, so the page doesn't jump.
  const skeletons = !waiting ? 0 : items.length ? 1 : SKELETONS;
  return (
    <div aria-busy={waiting} className="flex flex-col gap-3">
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {waiting
          ? items.length
            ? "Looking up more cards"
            : "Searching"
          : items.length
            ? `${items.length} ${items.length === 1 ? "card" : "cards"}. Enter picks the first.`
            : ""}
      </p>
      {problem && (
        <p className="flex items-start gap-2 px-4 py-3 text-sm text-warning shadow-[inset_0_0_0_1.5px_currentColor]">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{PROBLEM[problem]}</span>
          {problem !== "limit" && (
            <button
              type="button"
              onClick={props.onRetry}
              className="-my-3 min-h-11 font-semibold text-text underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
            >
              Try again
            </button>
          )}
        </p>
      )}
      {status === "done" && !items.length && !problem && (
        <p className="text-muted-foreground">
          No cards found. Check the spelling, or try the set name or number.
        </p>
      )}
      {(items.length > 0 || skeletons > 0) && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {items.map((it) => (
            <ResultItem key={it.id} item={it} onPick={props.onPick} />
          ))}
          {Array.from({ length: skeletons }, (_, i) => (
            <li
              key={`s${i}`}
              aria-hidden
              className="flex items-center gap-3 px-1 py-2"
            >
              <span className="aspect-[63/88] w-14 shrink-0 animate-pulse bg-surface" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-2/3 animate-pulse bg-surface" />
                <span className="h-3.5 w-1/3 animate-pulse bg-surface" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultItem({
  item,
  onPick,
}: {
  item: SearchItem;
  onPick: (item: SearchItem) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(item)}
        className="flex min-h-20 w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-surface active:bg-surface focus-visible:outline-offset-[-2px]"
      >
        <CardThumb
          src={item.imageUrl}
          kind={item.kind}
          language={item.language}
          number={item.number}
          className="w-14"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            lang={item.language === "en" ? undefined : item.language}
            className="line-clamp-2 font-semibold"
          >
            {item.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {item.setName}
            {item.number && <span className="num"> #{item.number}</span>}
          </span>
        </span>
        {item.market !== null && (
          <span className="num shrink-0 text-right text-md font-semibold">
            <span className="sr-only">Market </span>
            {usd(Number(item.market))}
            {/* Search prices a single at Near Mint; condition comes after. */}
            {item.kind === "raw" && (
              <span className="block text-xs font-normal text-muted-foreground">
                NM
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  );
}

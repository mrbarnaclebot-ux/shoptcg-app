"use client";

import { cn } from "cn";
import { Check } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";
import { TapeHatch } from "@/components/tape-hatch";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EventItem, Room } from "@/lib/claim-events";
import { usd } from "@/lib/format";
import { altPrice, formatAlt } from "@/lib/fx";
import { Art, HTML_LANG, metaLine } from "../../tile";
import { claimItem, joinClaimEvent, unclaimItem } from "./actions";

type Rules = {
  maxPerBuyer: number;
  allowUnclaim: boolean;
  payWithinHours: number;
  startsAt: string;
  endsAt: string;
};

type Errors = { name?: string; phone?: string; email?: string };

const POLL_MS = 3000;
// The buyer's details, remembered on this phone for the next event.
const DETAILS_KEY = "claim-buyer";

declare global {
  interface Window {
    turnstile?: { reset: (el?: string | HTMLElement) => void };
  }
}

function readDetails(): Partial<Record<keyof Errors, string>> {
  try {
    return JSON.parse(localStorage.getItem(DETAILS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** "2:05:09", "4:09" or "0:03". */
function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-semibold text-danger">
      {message}
    </p>
  );
}

/** The live event: countdown, the join form once, then one tap per claim. */
export function ClaimRoom(props: {
  slug: string;
  id: string;
  initial: Room;
  siteKey: string | null;
  storeName: string;
  currency: string | null;
  fxRate: number | null;
  rules: Rules;
}) {
  const { slug, id, rules } = props;
  const [room, setRoom] = useState(props.initial);
  // The server's countdowns are as of this moment; the clock runs from here.
  const [readAt, setReadAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const ended = room.status === "ended";

  const take = (next: Room | null) => {
    if (!next) return;
    setRoom(next);
    setReadAt(Date.now());
  };

  // Re-read every few seconds while the event can still change, when in view.
  useEffect(() => {
    if (ended) return;
    let stop = false;
    const read = async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/claim/${id}`, { cache: "no-store" }).catch(
        () => null,
      );
      if (!stop && res?.ok) take(await res.json());
    };
    const every = setInterval(read, POLL_MS);
    document.addEventListener("visibilitychange", read);
    return () => {
      stop = true;
      clearInterval(every);
      document.removeEventListener("visibilitychange", read);
    };
  }, [id, ended]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const gone = now - readAt;
  const toStart = room.msToStart - gone;
  const toEnd = room.msToEnd - gone;
  const joined = room.mine?.status === "pending";
  const units = room.mine?.units ?? 0;
  const open = room.status === "live" || room.status === "sold_out";
  const startsSoon = room.status === "scheduled" && toStart <= 0;

  return (
    <div className="mt-4 flex flex-col gap-6">
      <section
        aria-label="Event status"
        className="paper flex flex-col gap-2 p-4"
      >
        <p
          className="font-display num text-[1.75rem] leading-none font-extrabold"
          role="timer"
          aria-live="off"
        >
          {room.status === "scheduled" &&
            (startsSoon ? "Starting" : `Starts in ${clock(toStart)}`)}
          {open && `Ends in ${clock(toEnd)}`}
          {ended && "This event has ended"}
        </p>
        <p className="text-sm text-muted-foreground">
          {when(rules.startsAt)} to {when(rules.endsAt)}
        </p>
        {room.status === "sold_out" && (
          <p className="font-semibold">
            Everything is claimed. A claim given back comes back here until the
            end.
          </p>
        )}
        <p className="text-sm">
          Up to {rules.maxPerBuyer} {rules.maxPerBuyer === 1 ? "item" : "items"}{" "}
          each.{" "}
          {rules.allowUnclaim
            ? "You can give a claim back until the end."
            : "Claims are final."}{" "}
          Pay within {rules.payWithinHours}{" "}
          {rules.payWithinHours === 1 ? "hour" : "hours"} of the end, or your
          claims go back.
        </p>
      </section>

      {!ended && !joined && (
        <JoinForm
          slug={slug}
          id={id}
          siteKey={props.siteKey}
          storeName={props.storeName}
          onJoined={take}
          scheduled={room.status === "scheduled"}
        />
      )}
      {joined && !ended && (
        <p className="text-sm text-muted-foreground">
          You&apos;re in as{" "}
          <span className="font-semibold text-text">{room.mine?.name}</span>{" "}
          (WhatsApp +{room.mine?.phone}).
          {room.status === "scheduled" && " Claiming opens at the start."}
        </p>
      )}

      <section aria-label="Items">
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] lg:gap-x-5">
          {room.items.map((it) => (
            <ClaimTile
              key={it.id}
              it={it}
              slug={slug}
              eventId={id}
              canClaim={open && joined}
              canGiveBack={open && joined && rules.allowUnclaim}
              currency={props.currency}
              fxRate={props.fxRate}
              onRoom={take}
            />
          ))}
        </div>
      </section>

      {units > 0 && room.mine && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-semibold">
              Your claims: <span className="num">{units}</span>{" "}
              {units === 1 ? "item" : "items"},{" "}
              <span className="num">{usd(room.mine.total)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {room.mine.status === "confirmed"
                ? "Paid. Your receipt is in your email."
                : `Code ${room.mine.code}. ${props.storeName} will message you on WhatsApp to arrange payment.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function JoinForm(props: {
  slug: string;
  id: string;
  siteKey: string | null;
  storeName: string;
  scheduled: boolean;
  onJoined: (room: Room) => void;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  // Details from the last event, filled in after hydration.
  useEffect(() => {
    const saved = readDetails();
    for (const k of ["name", "phone", "email"] as const) {
      const el = form.current?.elements.namedItem(k);
      if (el instanceof HTMLInputElement && saved[k] && !el.value)
        el.value = saved[k];
    }
  }, []);

  const submit = (f: HTMLFormElement) =>
    start(async () => {
      setBanner(null);
      const data = new FormData(f);
      const res = await joinClaimEvent(props.slug, props.id, data).catch(
        () => null,
      );
      if (!res) {
        setBanner("Couldn't join. Check your connection and try again.");
      } else if ("fieldErrors" in res) {
        setErrors(res.fieldErrors);
        const first = (["name", "phone", "email"] as const).find(
          (k) => res.fieldErrors[k],
        );
        const el = first && f.elements.namedItem(first);
        if (el instanceof HTMLElement) el.focus();
      } else if ("error" in res) {
        setErrors({});
        setBanner(res.error);
      } else {
        try {
          localStorage.setItem(
            DETAILS_KEY,
            JSON.stringify({
              name: data.get("name"),
              phone: data.get("phone"),
              email: data.get("email"),
            }),
          );
        } catch {}
        props.onJoined(res.room);
        return;
      }
      // A Turnstile token works once.
      if (widget.current) window.turnstile?.reset(widget.current);
    });

  return (
    <form
      ref={form}
      noValidate
      aria-labelledby="join-title"
      className="paper flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <h2 id="join-title" className="text-lg font-bold">
        {props.scheduled ? "Join before it starts" : "Join to claim"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Once, for this event. Then each claim is one tap.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={80}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby="name-error"
        />
        <FieldError id="name-error" message={errors.name} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">WhatsApp number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={30}
          placeholder="+94 77 123 4567"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby="phone-help phone-error"
        />
        <p id="phone-help" className="text-sm text-muted-foreground">
          {props.storeName} messages you here to arrange payment.
        </p>
        <FieldError id="phone-error" message={errors.phone} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email for your receipt</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" message={errors.email} />
      </div>
      {props.siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
          />
          <div
            ref={widget}
            className="cf-turnstile"
            data-sitekey={props.siteKey}
          />
        </>
      )}
      <p className="text-sm text-muted-foreground">
        By joining, you share your name, WhatsApp number and email with{" "}
        {props.storeName} for your claims and receipt. See{" "}
        <Link
          href="/terms#claim-events"
          className="text-text underline decoration-brand-text decoration-[1.5px] underline-offset-4"
        >
          Terms
        </Link>
        .
      </p>
      {banner && (
        <p role="alert" className="font-semibold text-danger">
          {banner}
        </p>
      )}
      <TicketButton type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Joining" : "Join the event"}
      </TicketButton>
    </form>
  );
}

function ClaimTile(props: {
  it: EventItem;
  slug: string;
  eventId: string;
  canClaim: boolean;
  canGiveBack: boolean;
  currency: string | null;
  fxRate: number | null;
  onRoom: (room: Room | null) => void;
}) {
  const { it } = props;
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const gone = !it.available;
  const more = it.mine < it.maxPerBuyer && !gone;
  const alt = it.price === null ? null : altPrice(it.price, props.fxRate);

  const act = (run: typeof claimItem) =>
    start(async () => {
      setNote(null);
      const res = await run(props.slug, props.eventId, it.id).catch(() => null);
      if (!res) return setNote("Couldn't reach the store. Try again.");
      props.onRoom(res.room);
      if (res.message) setNote(res.message);
    });

  const art = (
    <Art
      it={it}
      sizes="(min-width:1024px) 180px, 45vw"
      dim={gone && !it.mine}
    />
  );
  return (
    <article data-claim-tile className="flex flex-col">
      {gone && !it.mine ? (
        <TapeHatch label="Claimed" className="block">
          {art}
        </TapeHatch>
      ) : (
        art
      )}
      <h3
        lang={HTML_LANG[it.language]}
        className="mt-2 line-clamp-2 h-[2lh] text-[0.96875rem] leading-tight font-semibold"
      >
        {it.name}
      </h3>
      <p className="num mt-0.5 truncate text-xs text-muted-foreground">
        {metaLine(it)}
      </p>
      <p className="num mt-1 font-display text-xl leading-none font-extrabold">
        {it.price === null ? "Ask the seller" : usd(it.price)}
      </p>
      {props.currency && alt !== null && (
        <p className="num text-xs text-muted-foreground">
          approx. {formatAlt(props.currency, alt)}
        </p>
      )}
      <p
        className={cn(
          "mt-1 text-xs",
          it.available === 1 ? "font-semibold" : "text-muted-foreground",
        )}
      >
        {gone
          ? "All claimed"
          : it.available === 1
            ? "Last one"
            : `${it.available} left`}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {it.mine > 0 && (
          <p className="inline-flex items-center gap-1 font-semibold">
            <Check aria-hidden className="size-4 text-brand-text" />
            {it.mine > 1 ? `You claimed ${it.mine}` : "You claimed this"}
          </p>
        )}
        {props.canClaim && more && (
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => act(claimItem)}
            className={cn(
              lineButton,
              "w-full bg-brand text-on-brand shadow-none hover:bg-brand-hover",
            )}
          >
            {pending ? "Claiming" : it.mine ? "Claim another" : "Claim"}
          </button>
        )}
        {props.canGiveBack && it.mine > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(unclaimItem)}
            className="min-h-11 self-start text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
          >
            Give one back
          </button>
        )}
        {note && (
          <p role="status" className="text-sm font-semibold">
            {note}
          </p>
        )}
      </div>
    </article>
  );
}

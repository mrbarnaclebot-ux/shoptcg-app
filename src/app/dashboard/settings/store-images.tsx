"use client";

import { cn } from "cn";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SectionMark } from "@/components/section-mark";
import { lineButton } from "@/components/ticket-button";
import { toast } from "@/lib/toast";

// Mirrors MAX_IMAGE_BYTES on the server, which is the check that counts.
const MAX_BYTES = 4 * 1024 * 1024;
const TOO_BIG = "That image is over 4 MB. Pick a smaller one.";
const OFFLINE = "Couldn't reach the server. Check your connection and retry.";

type Kind = "banner" | "avatar";
const SLOTS = {
  banner: {
    title: "Banner",
    hint: "1500 x 500 pixels. Wide photos of your table work best.",
    shape: "aspect-[3/1] w-full",
  },
  avatar: {
    title: "Profile image",
    hint: "1000 x 1000 pixels. Your logo or face.",
    shape: "aspect-square w-32",
  },
} as const;

export function StoreImages(props: {
  banner: string | null;
  avatar: string | null;
}) {
  return (
    <section aria-labelledby="look-h" className="flex flex-col gap-4">
      <SectionMark n={2} id="look-h">
        Banner and profile image
      </SectionMark>
      <p className="text-sm text-muted-foreground">
        Shown at the top of your public page. JPEG, PNG or WebP, up to 4 MB
        each. We crop around the centre.
      </p>
      <Slot kind="banner" url={props.banner} />
      <Slot kind="avatar" url={props.avatar} />
    </section>
  );
}

function Slot({ kind, url }: { kind: Kind; url: string | null }) {
  const slot = SLOTS[kind];
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();

  const send = (method: "POST" | "DELETE", file?: File) =>
    start(async () => {
      setError(undefined);
      let why = OFFLINE;
      try {
        const res = await fetch(`/api/store-image?kind=${kind}`, {
          method,
          body: file,
        });
        if (res.ok) return router.refresh();
        why = ((await res.json()) as { error?: string }).error ?? OFFLINE;
      } catch {}
      setError(why);
      toast.notSaved(why);
    });
  const choose = (input: HTMLInputElement | null) => {
    const file = input?.files?.[0];
    if (!file) return;
    // The same file can be picked again after an error.
    input.value = "";
    if (file.size > MAX_BYTES) {
      setError(TOO_BIG);
      return toast.notSaved(TOO_BIG);
    }
    send("POST", file);
  };
  // A file picked before the page woke up fired its change event at nobody.
  const input = useRef<HTMLInputElement>(null);
  const picked = useRef(choose);
  useEffect(() => {
    picked.current(input.current);
  }, []);

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <div>
        <h3 className="font-semibold">{slot.title}</h3>
        <p className="text-sm text-muted-foreground">{slot.hint}</p>
      </div>
      {url ? (
        // Already resized and re-encoded by us, so no optimiser pass.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Your ${slot.title.toLowerCase()}`}
          className={cn(slot.shape, "bg-surface object-cover")}
        />
      ) : (
        <div
          className={cn(
            slot.shape,
            "grid place-items-center border border-dashed border-border-strong text-sm text-muted-foreground",
          )}
        >
          None yet
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            lineButton,
            "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand has-disabled:cursor-not-allowed has-disabled:opacity-45",
          )}
        >
          <Upload aria-hidden className="size-4" />
          {busy ? "Saving" : url ? "Replace" : "Choose image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={`${url ? "Replace" : "Choose"} ${slot.title.toLowerCase()}`}
            ref={input}
            disabled={busy}
            onChange={(e) => choose(e.target)}
          />
        </label>
        {url && (
          <button
            type="button"
            className="min-h-11 font-semibold underline decoration-[1.5px] underline-offset-[5px] disabled:opacity-45"
            disabled={busy}
            onClick={() => send("DELETE")}
          >
            Remove {slot.title.toLowerCase()}
          </button>
        )}
      </div>
      {error && (
        // The toast announces it; this keeps the reason next to the control.
        <p className="text-sm font-semibold text-danger">{error}</p>
      )}
    </div>
  );
}

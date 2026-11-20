"use client";

import { cn } from "cn";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { lineButton } from "@/components/ticket-button";
import { PREVIEW_COOKIE_ON } from "@/lib/preview-cookie";

const SIZES = [
  ["phone", "Phone"],
  ["desktop", "Desktop"],
] as const;

// The cookie has to exist before the store page is asked for.
const preview = () => {
  document.cookie = PREVIEW_COOKIE_ON;
};

/**
 * At a desk, the real store page in a frame at phone or desktop width. On a
 * phone a frame would scroll inside the page, so it opens the page itself,
 * where the preview strip says so and leads back.
 */
export function PreviewFrame({ slug, name }: { slug: string; name: string }) {
  const [size, setSize] = useState<"phone" | "desktop">("phone");
  return (
    <>
      {/* Plain links: the store page is another app section, not a dashboard route. */}
      <a
        href={`/${slug}`}
        onClick={preview}
        className={cn(lineButton, "self-start lg:hidden")}
      >
        Open your store in preview
      </a>
      <div className="hidden flex-wrap items-end justify-between gap-4 lg:flex">
        <Segmented
          label="Screen size"
          value={size}
          options={SIZES}
          onChange={setSize}
        />
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noreferrer"
          onClick={preview}
          className={lineButton}
        >
          <ExternalLink aria-hidden className="size-5" />
          Open in new tab
        </a>
      </div>
      <iframe
        ref={(el) => {
          if (!el || el.src || !matchMedia("(min-width: 64rem)").matches)
            return;
          preview();
          el.src = `/${slug}`;
        }}
        title={`${name} as buyers see it`}
        className={cn(
          "hidden w-full bg-bg shadow-[0_0_0_1px_var(--border-strong)] lg:block lg:h-[calc(100dvh-19rem)] lg:min-h-[420px]",
          size === "phone" && "lg:mx-auto lg:h-[780px] lg:w-[390px]",
        )}
      />
    </>
  );
}

"use client";

import { cn } from "cn";
import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { PREVIEW_COOKIE_ON } from "@/lib/preview-cookie";

const SIZES = [
  ["phone", "Phone"],
  ["desktop", "Desktop"],
] as const;

/**
 * The real store page in a frame, so a vendor at a desk sees the phone layout
 * buyers get. On a phone the frame is simply the screen.
 */
export function PreviewFrame({ slug, name }: { slug: string; name: string }) {
  const [size, setSize] = useState<"phone" | "desktop">("phone");
  return (
    <>
      {/* A phone has one size to show. */}
      <div className="hidden lg:block">
        <Segmented
          label="Screen size"
          value={size}
          options={SIZES}
          onChange={setSize}
        />
      </div>
      <iframe
        // The cookie has to exist before the frame asks for the page.
        ref={(el) => {
          if (!el || el.src) return;
          document.cookie = PREVIEW_COOKIE_ON;
          el.src = `/${slug}`;
        }}
        title={`${name} as buyers see it`}
        className={cn(
          "h-[calc(100dvh-17rem)] min-h-[420px] w-full bg-bg shadow-[0_0_0_1px_var(--border-strong)] lg:h-[calc(100dvh-19rem)]",
          size === "phone" && "lg:mx-auto lg:h-[780px] lg:w-[390px]",
        )}
      />
    </>
  );
}

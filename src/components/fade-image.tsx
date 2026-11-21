"use client";

import Image from "next/image";
import type { ComponentProps, SyntheticEvent } from "react";

const shown = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.fade = "in";
};

/**
 * next/image that fades in once it has loaded, instead of popping in row by
 * row on venue wifi. Only an image still loading at hydration is hidden, so
 * nothing already on screen (or shown before the script runs) ever blinks
 * out. The look is `img[data-fade]` in showfloor.css.
 */
export function FadeImage({ alt, ...props }: ComponentProps<typeof Image>) {
  return (
    <Image
      {...props}
      alt={alt}
      ref={(img) => {
        if (img && !img.complete) img.dataset.fade = "wait";
      }}
      onLoad={shown}
      onError={shown}
    />
  );
}

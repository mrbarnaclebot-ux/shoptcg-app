"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * Tap the art to see the whole scan, edge to edge. A native dialog: focus,
 * Escape and the backdrop come with it.
 */
export function ArtZoom(props: {
  src: string;
  name: string;
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={`View ${props.name} full size`}
        className={`block cursor-zoom-in ${props.className ?? ""}`}
      >
        {props.children}
      </button>
      <dialog
        ref={dialog}
        aria-label={props.name}
        // A tap anywhere closes it, the picture included.
        onClick={() => dialog.current?.close()}
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-[oklch(0_0_0/0.88)]"
      >
        {/* The original scan: may come from any allowed host at any size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.src}
          alt={props.name}
          className="max-h-[92dvh] w-auto max-w-[96vw] object-contain"
        />
        <button
          type="button"
          autoFocus
          aria-label="Close"
          className="fixed top-3 right-3 grid size-11 place-items-center bg-bg text-text"
        >
          <X aria-hidden className="size-5" />
        </button>
      </dialog>
    </>
  );
}

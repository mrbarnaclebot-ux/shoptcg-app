"use client";

import { useParams } from "next/navigation";
import { ViewTransition } from "react";

/**
 * The loading art box, under the same name as the tile it was tapped from,
 * so the tile's art grows into this box at once instead of waiting for the
 * page. The real art then takes the same name and the same place.
 */
export function LoadingArt() {
  const { id } = useParams<{ id?: string }>();
  const box = <span className="skeleton block aspect-[63/88]" />;
  if (!id) return box;
  return (
    <ViewTransition name={`art-${id}`} share="morph" default="none">
      {box}
    </ViewTransition>
  );
}

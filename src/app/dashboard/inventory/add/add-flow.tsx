"use client";

import { useState } from "react";
import { CatalogSearch } from "./catalog-search";
import { CustomForm } from "./custom-form";

export function AddFlow() {
  const [mode, setMode] = useState<"search" | "custom">("search");
  return (
    <div className="flex flex-col gap-6">
      {mode === "search" ? <CatalogSearch /> : <CustomForm />}
      <button
        type="button"
        onClick={() => setMode(mode === "search" ? "custom" : "search")}
        className="inline-flex min-h-11 items-center self-start font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
      >
        {mode === "search"
          ? "Not in the catalog, or not a card? Add it yourself"
          : "Back to catalog search"}
      </button>
    </div>
  );
}

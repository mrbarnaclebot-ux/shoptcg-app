"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { CatalogSearch } from "./catalog-search";
import { CustomForm } from "./custom-form";

export function AddFlow() {
  const [mode, setMode] = useState<"search" | "custom">("search");
  return (
    <div className="flex flex-col gap-6">
      <Segmented
        label="Add from"
        value={mode}
        onChange={setMode}
        options={[
          ["search", "Search catalog"],
          ["custom", "Custom item"],
        ]}
      />
      {mode === "search" ? (
        <CatalogSearch onCustom={() => setMode("custom")} />
      ) : (
        <CustomForm />
      )}
    </div>
  );
}

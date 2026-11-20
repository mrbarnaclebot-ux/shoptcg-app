"use client";

// Native radios styled as a segmented control: keyboard and screen reader
// behaviour come free. Used for small fixed choices (type, language, condition).
// Show floor chips: a cut-line box; the picked one is filled with the text colour.
import { useLayoutEffect, useRef } from "react";

const chipBox =
  "flex min-h-11 min-w-12 cursor-pointer items-center justify-center px-3.5 text-[0.9375rem] font-medium text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors hover:text-text";

/** The same box as a button that fills a field (cash given, an offer); pressed is filled. */
export const chip = `${chipBox} aria-pressed:bg-text aria-pressed:font-semibold aria-pressed:text-bg aria-pressed:shadow-none`;

export function Segmented<T extends string>(props: {
  label: string;
  name?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  const box = useRef<HTMLFieldSetElement>(null);
  // A tap before hydration moves the native radio but reaches no handler, and
  // the next render would undo it. Adopt it, so a seller on slow WiFi taps once.
  useLayoutEffect(() => {
    const tapped =
      box.current?.querySelector<HTMLInputElement>("input:checked");
    if (tapped && tapped.value !== props.value)
      props.onChange(tapped.value as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at hydration
  }, []);
  return (
    <fieldset ref={box} className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{props.label}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map(([value, text]) => (
          <label
            key={value}
            className={`${chipBox} has-checked:bg-text has-checked:font-semibold has-checked:text-bg has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus`}
          >
            <input
              type="radio"
              name={props.name ?? props.label}
              value={value}
              checked={props.value === value}
              onChange={() => props.onChange(value)}
              className="sr-only"
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

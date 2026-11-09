"use client";

// Native radios styled as a segmented control: keyboard and screen reader
// behaviour come free. Used for small fixed choices (type, language, condition).
// Show floor chips: a cut-line box; the picked one is filled with the text colour.
export function Segmented<T extends string>(props: {
  label: string;
  name?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{props.label}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map(([value, text]) => (
          <label
            key={value}
            className="flex min-h-11 min-w-12 cursor-pointer items-center justify-center px-3.5 text-[0.9375rem] font-medium text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] transition-colors hover:text-text has-checked:bg-text has-checked:font-semibold has-checked:text-bg has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
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

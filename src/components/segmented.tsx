"use client";

// Native radios styled as a segmented control: keyboard and screen reader
// behaviour come free. Used for small fixed choices (type, language, condition).
export function Segmented<T extends string>(props: {
  label: string;
  name?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{props.label}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map(([value, text]) => (
          <label
            key={value}
            className="flex min-h-11 min-w-12 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface-2 px-3 text-sm font-semibold has-checked:border-brand has-checked:bg-brand-bg has-checked:text-sunrise-200 has-focus-visible:ring-2 has-focus-visible:ring-focus"
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

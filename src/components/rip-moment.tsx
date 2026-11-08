import type { CSSProperties, ReactNode } from "react";

/**
 * Direction C celebration, reserved for store created, first item added and
 * (Phase 6) sale confirmed: crimped pack edge, one foil sweep, headline slam.
 * Pure CSS; under reduced motion it renders the final frame.
 */
export function RipMoment(props: {
  kicker: string;
  headline: string;
  children?: ReactNode;
}) {
  return (
    <section role="status" className="flex flex-col">
      <div aria-hidden className="rip-crimp" />
      <div className="rip flex flex-col gap-3 px-5 pt-4 pb-5">
        <span aria-hidden className="rip-foil" />
        <p className="text-xs font-bold tracking-[0.14em] text-subtle uppercase">
          {props.kicker}
        </p>
        <h2
          aria-label={props.headline}
          className="text-[2rem] leading-[1] font-black uppercase wdth-125 md:text-[2.5rem]"
        >
          {props.headline.split(" ").map((word, i) => (
            <span
              key={i}
              aria-hidden
              className="rip-word mr-[0.25em]"
              style={{ "--i": i } as CSSProperties}
            >
              {word}
            </span>
          ))}
        </h2>
        {props.children}
      </div>
    </section>
  );
}

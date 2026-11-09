import type { ReactNode } from "react";
import { Stamp } from "./stamp";
import { Ticket } from "./ticket";

/**
 * The show-floor celebration for earned moments only: store created, first
 * item, and (Phase 6) sale confirmed. A rubber stamp lands on a paper ticket,
 * then the stub is punched. Pure CSS; under reduced motion it renders the
 * final frame.
 */
export function ShowMoment(props: {
  stamp: string;
  headline: string;
  no?: string;
  children?: ReactNode;
}) {
  return (
    <Ticket
      no={props.no}
      className="[--stub:4.5rem]"
      bodyClassName="relative flex flex-col gap-4"
      stub={<span aria-hidden className="moment-punch mx-auto mt-auto" />}
    >
      {/* Lands across the perforation, as a stamp would. */}
      <Stamp className="moment-stamp absolute top-4 -right-10">
        {props.stamp}
      </Stamp>
      <h2 className="font-display pr-14 text-[2.75rem] leading-[0.85] font-black md:text-[3.5rem]">
        {props.headline}
      </h2>
      {props.children}
    </Ticket>
  );
}

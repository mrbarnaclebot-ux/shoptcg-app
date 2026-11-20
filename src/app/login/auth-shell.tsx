import { getImageProps } from "next/image";
import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { Ticket } from "@/components/ticket";
import table from "../../../public/media/table.jpg";

export const authLink =
  "text-text underline decoration-brand decoration-[1.5px] underline-offset-4";

/** The hall photo beside a paper form: sign in and join. */
export function AuthShell(props: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  foot: ReactNode;
  /** The header's "Seller sign in"; off where this page is the way in. */
  signIn?: boolean;
}) {
  return (
    <div className="grid flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <figure className="grain relative hidden md:block">
        {/* getImageProps: no client image component in the login bundle. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is in the props */}
        <img
          {...getImageProps({
            src: table,
            alt: "A vendor table under a clamp lamp: toploaders in rows, slabs and a cash box",
            sizes: "50vw",
          }).props}
          className="absolute inset-0 size-full object-cover"
        />
        <figcaption className="absolute bottom-6 left-6 z-[3] bg-night/80 px-3 py-2 text-[0.8125rem] text-muted-foreground">
          <b className="font-semibold text-text">7:40 AM.</b> Doors open at
          nine. The table is already priced.
        </figcaption>
      </figure>
      <div className="flex flex-col px-4 md:px-12">
        <PublicHeader signIn={props.signIn} className="px-0 md:px-0" />
        <main className="flex w-full max-w-[440px] flex-1 flex-col gap-7 pt-8 md:justify-center md:pt-0 md:pb-24">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-display font-black">
              {props.title}
            </h1>
            {props.intro && (
              <p className="text-muted-foreground">{props.intro}</p>
            )}
          </div>
          <Ticket as="div" className="[--stub:2rem]">
            {props.children}
          </Ticket>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {props.foot}
          </div>
        </main>
        <PublicFooter className="px-0 md:px-0" />
      </div>
    </div>
  );
}

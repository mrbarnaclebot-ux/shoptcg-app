import { getImageProps } from "next/image";
import Link from "next/link";
import handoff from "../../public/media/handoff.jpg";
import scan from "../../public/media/scan.jpg";

const STEPS = [
  {
    title: "Add your stock.",
    body: "Search by name or number, or import a CSV. Raw, graded and sealed, priced from last night's market.",
  },
  {
    title: "Share your store.",
    body: "Your own link for socials, groups and DMs, and a QR sign for the show table. One store, wherever you sell.",
  },
  {
    title: "Take orders anywhere.",
    body: "Carts ping your phone. Confirm the sale, the receipt emails itself, and your ledger tracks stock, takings and profit.",
  },
];

function Photo(props: {
  src: typeof scan;
  alt: string;
  when: string;
  caption: string;
  className: string;
}) {
  return (
    <figure>
      <div className="grain">
        {/* getImageProps keeps the landing free of the client image component. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is in the props */}
        <img
          {...getImageProps({
            src: props.src,
            alt: props.alt,
            sizes: "(min-width: 768px) 50vw, 100vw",
          }).props}
          className={`w-full object-cover ${props.className}`}
        />
      </div>
      <figcaption className="mt-2.5 max-w-[52ch] text-[0.8125rem] text-muted-foreground">
        <b className="font-semibold text-text">{props.when}</b> {props.caption}
      </figcaption>
    </figure>
  );
}

/** The paper programme under the hero: three steps, two photos, the proof line. */
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-h" className="paper">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 pt-10 pb-12 md:grid md:grid-cols-12 md:gap-x-8 md:gap-y-0 md:px-14 md:pb-24">
        <div className="md:col-span-5 md:row-span-2">
          <Photo
            src={scan}
            alt="A buyer holds a phone over a small QR sign on an easel, lit by a clamp lamp at a card show table"
            when="Table 42."
            caption="One scan and the whole shelf is in their hand, prices included. Nobody has to ask how much twenty times."
            className="h-[460px] md:h-[720px]"
          />
        </div>
        <h2
          id="how-h"
          className="font-display text-[4.25rem] leading-[0.82] font-black tracking-[-0.01em] md:col-span-6 md:col-start-7 md:mt-2 md:mb-12 md:text-[7rem]"
        >
          Three things,
          <br />
          <span className="text-brand-text">then sell.</span>
        </h2>
        <ol className="grid gap-8 self-start md:col-span-6 md:col-start-7">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="grid grid-cols-[56px_1fr] items-start border-t-[1.5px] border-text pt-4 md:grid-cols-[88px_1fr]"
            >
              <span className="font-display num text-[3.5rem] leading-[0.78] font-black text-brand-text md:text-[4.75rem]">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[1.3125rem] leading-tight font-bold tracking-[-0.01em]">
                  {s.title}
                </h3>
                <p className="mt-1 max-w-[46ch] text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="grid gap-8 md:col-span-12 md:mt-24 md:grid-cols-[7fr_5fr] md:items-end">
          <Photo
            src={handoff}
            alt="Cash and a graded card in a clear slab change hands over a black tablecloth"
            when="9:31 PM."
            caption="Cash on the cloth, slab across the table, receipt already on its way."
            className="h-[260px] object-[50%_60%] md:h-[440px]"
          />
          <p className="font-display text-[2.125rem] leading-[1.02] font-extrabold md:text-[2.875rem]">
            Nightly price sync. Raw, graded{" "}
            <span className="text-brand-text">and</span> sealed. EN, JP{" "}
            <span className="text-brand-text">and</span> CN. Online{" "}
            <span className="text-brand-text">and</span> at the table.
          </p>
        </div>
        <footer className="flex flex-wrap gap-x-7 gap-y-1 border-t border-border pt-5 text-[0.84rem] text-muted-foreground md:col-span-12 md:mt-18">
          <Link
            href="/help"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Help
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Terms
          </Link>
          <p className="self-center md:ml-auto">
            Not affiliated with Nintendo, Creatures, GAME FREAK or The Pokemon
            Company.
          </p>
        </footer>
      </div>
    </section>
  );
}

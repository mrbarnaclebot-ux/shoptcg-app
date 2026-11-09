import { getImageProps } from "next/image";
import { StubValue, Ticket } from "@/components/ticket";
import sea from "../../public/media/card-sea.jpg";
import sunset from "../../public/media/card-sunset.jpg";

// A buyer's request, dropped on the hero photo the way it lands on the
// vendor's phone. Fictional cards with original art; decorative only.
const LINES = [
  {
    img: sea,
    name: "Tidecaller",
    meta: "Driftwood Tide 031/165. NM",
    price: "1 x $42.00",
  },
  {
    img: sunset,
    name: "Dune Lantern",
    meta: "Ember Coast 114/198. LP",
    price: "2 x $22.00",
  },
];

export function RequestTicket() {
  return (
    <Ticket
      as="div"
      no="0187"
      className="w-[430px]"
      stub={
        <>
          <StubValue k="Table" v="B14" />
          <StubValue k="Hold" v="14:32" hold />
        </>
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[1.875rem] leading-none font-extrabold">
          Maya R.
        </span>
        <span className="text-[0.8125rem] text-muted-foreground">just now</span>
      </div>
      <ul className="mt-3.5 mb-3 text-sm">
        {LINES.map((l) => (
          <li
            key={l.name}
            className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-border py-1.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- decorative, alt is "" */}
            <img
              {...getImageProps({ src: l.img, alt: "", width: 34, height: 46 })
                .props}
              className="h-[46px] w-[34px] object-cover"
            />
            <span>
              {l.name}
              <small className="block text-[0.78rem] text-muted-foreground">
                {l.meta}
              </small>
            </span>
            <span className="num">{l.price}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t-[1.5px] border-text pt-2 font-semibold">
        <span>3 items</span>
        <span className="font-display num text-[1.875rem] leading-none font-extrabold">
          $86.00
        </span>
      </div>
    </Ticket>
  );
}

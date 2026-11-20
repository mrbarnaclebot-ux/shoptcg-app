import { getImageProps } from "next/image";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { TicketButton } from "@/components/ticket-button";
import aisle from "../../public/media/aisle.jpg";
import poster from "../../public/media/hero-poster.jpg";
import { HeroVideo } from "./hero-video";
import { HowItWorks } from "./how-it-works";
import { RequestTicket } from "./request-ticket";
import "./landing.css";

// Art direction: the aisle runs vertical on a phone, the hall runs wide above.
// The visible one is the LCP element, so it is fetched eagerly at high priority.
function HeroPicture() {
  const common = { alt: "", fetchPriority: "high", loading: "eager" } as const;
  const wide = getImageProps({ ...common, src: poster, sizes: "100vw" }).props;
  const tall = getImageProps({ ...common, src: aisle, sizes: "100vw" }).props;
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wide.srcSet} sizes="100vw" />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is in the props: the photo is decorative */}
      <img
        {...tall}
        className="absolute inset-0 size-full object-cover object-[50%_60%] md:object-[50%_40%]"
      />
    </picture>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-h"
      // Grows past the viewport when the copy needs it (text zoom), never clips it.
      className="relative overflow-hidden md:flex md:min-h-[max(640px,min(880px,100svh))] md:flex-col md:justify-end"
    >
      {/* On a phone the photo stops short of half the screen, so the
          headline and the invite button are on the first one. */}
      <div className="grain relative h-[min(380px,45svh)] overflow-hidden md:absolute md:inset-0 md:h-auto">
        <HeroPicture />
        <HeroVideo />
        <div aria-hidden className="hero-shade absolute inset-0 z-[1]" />
      </div>
      <PublicHeader className="absolute inset-x-0 top-0 z-10" />
      <div
        aria-hidden
        className="absolute top-[22%] right-[6%] z-10 hidden rotate-[-2.5deg] drop-shadow-[0_22px_40px_oklch(0_0_0/0.55)] xl:block"
      >
        <RequestTicket />
      </div>
      <HeroCopy />
      <p className="absolute right-14 bottom-8 z-10 hidden max-w-[30ch] text-right text-[0.8125rem] text-muted-foreground lg:block">
        Saturday, 9:14 PM. Zone B, tables 42 and 43.
      </p>
    </section>
  );
}

function HeroCopy() {
  return (
    <div className="relative z-10 -mt-[5.5rem] flex flex-col px-4 md:mt-0 md:ml-14 md:w-[min(860px,calc(100%-7rem))] md:px-0 md:pt-28">
      {/* Wraps on a phone: at 150% text size the rem floor outgrows the
          screen, and a nowrap line would be clipped. */}
      <h1
        id="hero-h"
        className="font-display -ml-1.5 text-[clamp(4.5rem,23vw,9rem)] leading-[0.8] font-black tracking-[-0.012em] md:order-last md:whitespace-nowrap md:-mb-1.5 md:-ml-3.5 md:text-[clamp(7rem,16.4vw,14.75rem)]"
      >
        <span className="block">Your shop,</span>
        <span className="block text-brand">priced live.</span>
      </h1>
      <p className="mt-8 max-w-[44ch] text-[1.0625rem] leading-normal md:mt-0 md:text-[1.1875rem]">
        Run your Pokemon card business from one live-priced store: cards, slabs
        and sealed at market prices. Share your link online or put the QR on
        your show table. Buyers fill a cart and send it to you.{" "}
        <span className="text-brand">You confirm the sale.</span>
      </p>
      <div className="mt-6 mb-2 flex flex-col items-stretch gap-1 md:mt-7 md:mb-9 md:flex-row md:items-center md:gap-7">
        {/* /join opens on asking; a code holder picks "I have a code" there. */}
        <TicketButton href="/join">Get an invite</TicketButton>
        <a
          href="#how-it-works"
          className="inline-flex min-h-11 items-center self-start underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          How it works
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <main className="flex-1">
        <Hero />
        <HowItWorks />
      </main>
      <PublicFooter />
    </div>
  );
}

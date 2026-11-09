// Static store preview for the landing page. Abstract SVG art only:
// card images are data, never marketing (UI-SPEC section 9).
import { Card, Slab, type Scene } from "./card-art";

const items: {
  name: string;
  meta: string;
  price: number;
  scene: Scene;
  grade?: string;
}[] = [
  {
    name: "Umbreon VMAX",
    scene: "night",
    grade: "10",
    meta: "Evolving Skies 215/203. PSA 10",
    price: 1240,
  },
  {
    name: "Charizard ex",
    scene: "ember",
    meta: "Obsidian Flames 223/197. NM",
    price: 42,
  },
  {
    name: "Mew ex",
    scene: "bubble",
    meta: "Paldean Fates 232/091. NM",
    price: 38.5,
  },
  {
    name: "Gardevoir ex",
    scene: "grove",
    meta: "Paldea Evolved 254/193. LP",
    price: 19,
  },
];

const usd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PhonePreview() {
  return (
    <div
      aria-hidden="true"
      className="group relative mx-auto w-full max-w-[288px] rounded-[2.75rem] bg-surface-2 p-2.5 shadow-3 ring-1 ring-border"
    >
      <div className="overflow-hidden rounded-[2.25rem] bg-bg px-4 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-surface-2 text-sm font-extrabold text-sunrise-300 shadow-2 wdth-118">
            RC
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold wdth-112">
              Ridgeline Cards
            </p>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <span className="size-1.5 rounded-full bg-success" />
              Open now
            </p>
          </div>
        </div>
        <div className="mt-4 h-10 rounded-md border border-border-strong bg-surface-2 px-3 text-sm leading-10 text-subtle">
          Search this table
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
          {items.map((item) => (
            <li key={item.name} className="min-w-0">
              <div className="flex aspect-[63/88] justify-center">
                {item.grade ? (
                  <div className="relative h-full">
                    <Slab
                      scene={item.scene}
                      id={item.scene}
                      grade={item.grade}
                    />
                    {/* Foil sheen over the slabbed card only; brightens on hover. */}
                    <div className="holo absolute top-[21%] left-[10.8%] h-[65.7%] w-[78.3%]" />
                  </div>
                ) : (
                  <Card
                    scene={item.scene}
                    id={item.scene}
                    className="block h-full drop-shadow-[0_6px_10px_rgb(0_0_0/0.45)]"
                  />
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.meta}
              </p>
              <p className="num mt-1 text-base">
                <span className="font-medium text-muted-foreground">$</span>
                {usd.format(item.price)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

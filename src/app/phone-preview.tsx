// Static store preview for the landing page. Neutral gradient art only:
// card images are data, never marketing (UI-SPEC section 9).
const items = [
  {
    name: "Umbreon VMAX",
    meta: "Evolving Skies 215/203. PSA 10",
    price: 1240,
    art: "linear-gradient(160deg,#5b5f68,#30333a 60%,#24262c)",
  },
  {
    name: "Charizard ex",
    meta: "Obsidian Flames 223/197. NM",
    price: 42,
    art: "linear-gradient(165deg,#6b6e76,#3c3f46 55%,#2a2c32)",
  },
  {
    name: "Mew ex",
    meta: "Paldean Fates 232/091. NM",
    price: 38.5,
    art: "linear-gradient(150deg,#62666e,#3a3d44 60%,#2b2d33)",
  },
  {
    name: "Gardevoir ex",
    meta: "Paldea Evolved 254/193. LP",
    price: 19,
    art: "linear-gradient(170deg,#4f535b,#2f3238 60%,#222428)",
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
      className="mx-auto w-full max-w-[320px] rounded-[2.75rem] bg-surface-2 p-2.5 shadow-3 ring-1 ring-border"
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
              <div
                className="aspect-[63/88] rounded-[4.6%/3.3%] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
                style={{ background: item.art }}
              />
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

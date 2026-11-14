// Desktop layouts as ruled tiles, like a printed show program: 1px lines, no
// floating cards. Phones keep the plain stack (they get these classes too,
// and only the lg: half applies on a wide screen).

/** Equal tiles, two a row; an odd last tile takes the whole row. */
export const bento =
  "flex flex-col gap-10 lg:grid lg:grid-cols-2 lg:gap-0 lg:border-t lg:border-l lg:border-border lg:*:border-r lg:*:border-b lg:*:border-border lg:*:p-8 lg:[&>*:last-child:nth-child(odd)]:col-span-2";

/**
 * One column of tiles in a two-column page, for tiles of very different
 * heights (a growing queue beside short boxes). On a phone the column
 * disappears (display: contents) and its tiles join the page's stack, so
 * `order-*` on each tile keeps the phone order.
 */
export const bentoColumn =
  "contents lg:flex lg:flex-col lg:*:p-8 lg:[&>*+*]:border-t lg:[&>*+*]:border-border";

/** The two-column page grid; pair with bentoLeft / bentoRight columns. */
export const bentoPage = "lg:grid lg:content-start lg:gap-0";
export const bentoLeft = "lg:border lg:border-border";
export const bentoRight = "lg:border-y lg:border-r lg:border-border";

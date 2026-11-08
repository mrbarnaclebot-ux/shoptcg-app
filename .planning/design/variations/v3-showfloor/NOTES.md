# V3: Show floor, after dark

## The idea
The product lives in a convention hall at night, so the hall is the brand: documentary photos of lamp-lit tables carry the emotion.
Everything a buyer or seller holds (requests, receipts, the list bar, the table sign) is cut from warm paper ticket stock with perforated stubs and stub numbers.
Table numbers are the wayfinding system, set big in a poster face that is allowed to crop off the edge.

## Fonts
- Big Shoulders Display (600/800/900): table numbers, prices, store names, headlines. Condensed civic signage, reads from three metres.
- Schibsted Grotesk (400 to 700): all body and UI copy, sentence case. Plain newsprint grotesk, tabular numerals for prices.
- No tracked uppercase micro-labels. Section markers are big numerals plus a sentence-case title.

## Colour, by job
- Galaxy black #090911 = the hall. Page and dark surfaces only.
- Seal grey #7E848B = metadata and the dividers between things; tinted neutrals derived from it.
- Sunrise orange #F77C10 = lamplight. Only where the eye should land: the table number block, the hold timer, the one primary ticket button, the "under market" stamp outline. Never a gradient, never a wash. A darker orange (oklch 0.54 0.16 48) is used for text on paper so it passes contrast.
- Paper (oklch 0.955 0.013 82) = a fourth, physical material: tickets, receipts, toasts, the list bar, the component sheet, the sign. This is what breaks "dark mode with orange buttons".

## fal.ai
- Stills: `fal-ai/nano-banana-pro` (Nano Banana Pro, recommend_model's pick), 6 images at 2K, about $0.15 each = $0.90.
- Motion: `alibaba/wan-3.0-prime/image-to-video` (Wan 3.0 Prime), 5 s 1080p, no audio, start frame = end frame for a seamless loop, about $0.25. The push-in is a 22 s CSS scale on top of the loop so the two never fight.
- Total: about $1.15.
- Post: ffmpeg resize/recompress (all images under 180 KB, video 400 KB at 1600 px / 24 fps, poster jpg). The aisle photo is cropped to remove a poster with a real logo; the slab label was painted blank (a grader logo had appeared); the table photo is cropped to remove a marker brand.

Prompts (shared style: "Documentary photograph, 35mm film, Portra 800 grain ... no readable text, no logos, no brand names, no characters"):
1. floor (16:9, hero + video source): long aisle of folding vendor tables, glass cases, each table lit by a black clamp lamp, deep blue-black hall, shoppers faces turned away or blurred, handwritten cardboard table numbers, low camera at table height.
2. scan (4:5): over-the-shoulder, hand holds a phone up to a small QR sign on an easel, warm clamp lamp, glass case of sleeved cards blurred.
3. handoff (3:2): two pairs of hands, banknotes one way, a graded slab with a blank label the other, black tablecloth.
4. aisle (9:16, phone hero): narrow aisle, lamps both sides, crowd from behind, handwritten "Table 42" sign in foreground.
5. table (4:5): one vendor table, toploaders in rows, slabs with blank labels, plain shrink-wrapped boxes, cash box.
6. flatlay (3:2): six sleeved cards with original gouache landscapes (sea, forest, sunset, storm...), one slab, one plain sealed box, cropped into product tiles.
Video prompt: locked-off camera, shoppers walk slowly, hoodie man gestures, lamp flickers slightly, returns to the starting composition.

## Why it does not look AI-made
- Real-feeling photography with a specific time and place ("Saturday, 9:14 PM. Zone B") and captions written like a photo essay, instead of abstract gradient art or grid backgrounds.
- Product art is photographed sleeved cards with painterly art, not gradient rectangles.
- A physical metaphor taken all the way: notched ticket buttons with a perforated arrow stub, request tickets with tear-off code and hold timer, a receipt-edge success toast, a hang-tag price, a rubber-stamp "under market" badge two degrees off true, tape-hatch "On hold".
- Square corners everywhere (tickets are cut, not moulded); no pills, no glass, no soft shadows on cards, no side-stripe accents.
- Asymmetric hero: headline bleeds off the bottom, the product appears as a ticket dropped on the photo, not a phone mockup on the right.
- Two materials (hall and paper) instead of one dark theme; the copy is the SCREENS.md vendor voice, no SaaS slogans.

## Notes
- Reduced motion: the video is never loaded, the poster image shows; toasts fade instead of tearing in.
- Print: the sign section prints alone at A5 (`@page size A5`). The QR is a non-scannable placeholder.
- PRODUCT.md / DESIGN.md do not exist in the repo; .planning/PROJECT.md and SCREENS.md were used as product context.

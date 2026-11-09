// Original abstract card art for the landing preview. Inline SVG only:
// no characters, logos or official card layouts (UI-SPEC section 9).
import type { ReactNode } from "react";

export type Scene = "night" | "ember" | "bubble" | "grove";

type Palette = { body: string; sky: [string, string] };

const palettes: Record<Scene, Palette> = {
  night: { body: "#1E1A3A", sky: ["#3B2F7A", "#120F2A"] },
  ember: { body: "#3A1B12", sky: ["#FFB25C", "#B23A1E"] },
  bubble: { body: "#2E2140", sky: ["#F4A3C8", "#6FB7E8"] },
  grove: { body: "#122A26", sky: ["#7FD8B6", "#1F5E52"] },
};

// Art window content, drawn in a 51 x 38 box.
function art(scene: Scene, id: string): ReactNode {
  switch (scene) {
    case "night":
      return (
        <>
          <circle
            cx="34"
            cy="16"
            r="22"
            fill="none"
            stroke="#A9ABC7"
            strokeOpacity=".18"
          />
          <circle
            cx="34"
            cy="16"
            r="15"
            fill="none"
            stroke="#A9ABC7"
            strokeOpacity=".22"
          />
          <circle cx="34" cy="16" r="9" fill="#F2F3F9" />
          <circle cx="37.5" cy="13.5" r="8" fill={`url(#${id}-sky)`} />
          <g fill="#F2F3F9">
            <circle cx="8" cy="7" r=".6" />
            <circle cx="15" cy="22" r=".45" />
            <circle cx="46" cy="31" r=".5" />
            <circle cx="22" cy="5" r=".4" />
          </g>
          <path
            d="M0 38 L0 30 Q14 24 26 30 T51 28 L51 38 Z"
            fill="#090911"
            fillOpacity=".55"
          />
        </>
      );
    case "ember":
      return (
        <>
          <circle cx="25.5" cy="20" r="10" fill="#FFE7C2" fillOpacity=".9" />
          <path d="M0 38 L12 22 L20 29 L31 15 L51 34 L51 38 Z" fill="#4A160C" />
          <path d="M0 38 L9 31 L19 35 L33 27 L51 38 Z" fill="#240A06" />
        </>
      );
    case "bubble":
      return (
        <g fill="#FFFFFF" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth=".5">
          <circle cx="16" cy="20" r="11" fillOpacity=".12" />
          <circle cx="35" cy="12" r="6" fillOpacity=".18" />
          <circle cx="40" cy="28" r="4" fillOpacity=".1" />
          <circle cx="13" cy="16" r="2.5" fillOpacity=".5" stroke="none" />
        </g>
      );
    case "grove":
      return (
        <g fill="none" stroke="#E6FFF5" strokeOpacity=".55" strokeWidth=".7">
          <path
            d="M25.5 36 C 12 26 12 12 25.5 3 C 39 12 39 26 25.5 36 Z"
            fill="#0C3A31"
            fillOpacity=".5"
          />
          <path d="M25.5 36 V 6" />
          <path d="M25.5 26 L 18 19 M25.5 20 L 33 13 M25.5 14 L 20 10" />
          <path
            d="M2 36 Q 10 28 6 18 M49 36 Q 41 28 45 18"
            strokeOpacity=".3"
          />
        </g>
      );
  }
}

/** A raw card in a 63 x 88 coordinate box. */
export function Card({
  scene,
  id,
  ...box
}: {
  scene: Scene;
  id: string;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  const p = palettes[scene];
  return (
    <svg viewBox="0 0 63 88" {...box}>
      <defs>
        <linearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E5E8EC" />
          <stop offset=".45" stopColor="#7E848B" />
          <stop offset=".7" stopColor="#D1D5D9" />
          <stop offset="1" stopColor="#4B5056" />
        </linearGradient>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <pattern
          id={`${id}-foil`}
          width="1.6"
          height="1.6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(32)"
        >
          <rect width=".5" height="1.6" fill="#FFFFFF" fillOpacity=".07" />
        </pattern>
      </defs>
      <rect width="63" height="88" rx="3.2" fill={`url(#${id}-frame)`} />
      <rect x="2.2" y="2.2" width="58.6" height="83.6" rx="2.2" fill={p.body} />
      <rect
        x="6"
        y="5.5"
        width="28"
        height="2.4"
        rx="1.2"
        fill="#F3F5F8"
        fillOpacity=".75"
      />
      <rect
        x="47"
        y="5.5"
        width="10"
        height="2.4"
        rx="1.2"
        fill="#F3F5F8"
        fillOpacity=".4"
      />
      <svg x="6" y="10.5" width="51" height="38" viewBox="0 0 51 38">
        <rect width="51" height="38" fill={`url(#${id}-sky)`} />
        {art(scene, id)}
        <rect width="51" height="38" fill={`url(#${id}-foil)`} />
      </svg>
      <rect
        x="6"
        y="10.5"
        width="51"
        height="38"
        fill="none"
        stroke="#F3F5F8"
        strokeOpacity=".25"
        strokeWidth=".5"
      />
      <g fill="#F3F5F8">
        <rect x="6" y="54" width="34" height="1.8" rx=".9" fillOpacity=".35" />
        <rect x="6" y="59" width="45" height="1.4" rx=".7" fillOpacity=".2" />
        <rect x="6" y="63" width="40" height="1.4" rx=".7" fillOpacity=".2" />
        <rect x="6" y="70" width="51" height=".4" fillOpacity=".15" />
        <rect x="6" y="80" width="12" height="1.4" rx=".7" fillOpacity=".25" />
        <rect x="49" y="80" width="8" height="1.4" rx=".7" fillOpacity=".25" />
      </g>
    </svg>
  );
}

/** A graded slab: clear case, label, card inside. 60 x 100 box. */
export function Slab({
  scene,
  id,
  grade,
}: {
  scene: Scene;
  id: string;
  grade: string;
}) {
  return (
    <svg viewBox="0 0 60 100" className="block h-full">
      <rect
        x=".5"
        y=".5"
        width="59"
        height="99"
        rx="4"
        fill="#F3F5F8"
        fillOpacity=".08"
        stroke="#F3F5F8"
        strokeOpacity=".28"
      />
      <rect x="3" y="3" width="54" height="14" rx="1.5" fill="#E5E8EC" />
      <g fill="#26292E">
        <rect x="6" y="6.5" width="22" height="1.6" rx=".8" />
        <rect x="6" y="10" width="15" height="1.2" rx=".6" fillOpacity=".55" />
        <rect x="6" y="13" width="18" height="1.2" rx=".6" fillOpacity=".55" />
      </g>
      <text
        x="53"
        y="13.5"
        textAnchor="end"
        fontSize="8"
        fontWeight="800"
        fill="#090911"
        style={{ fontVariationSettings: '"wdth" 118' }}
      >
        {grade}
      </text>
      <rect
        x="5"
        y="20"
        width="50"
        height="76"
        rx="2"
        fill="#090911"
        fillOpacity=".35"
      />
      <Card scene={scene} id={id} x={6.5} y={21} width={47} height={66} />
    </svg>
  );
}

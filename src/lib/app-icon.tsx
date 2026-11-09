import { ImageResponse } from "next/og";

/** The home screen icon: "st" and the lamp dot on galaxy black. */
export function appIcon(px: number) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#090911",
        color: "#F6F1E6",
        fontSize: px * 0.56,
        fontWeight: 800,
        letterSpacing: "-0.04em",
      }}
    >
      st<span style={{ color: "#FF7A1A" }}>.</span>
    </div>,
    { width: px, height: px },
  );
}

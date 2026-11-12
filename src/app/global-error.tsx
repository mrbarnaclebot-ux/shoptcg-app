"use client";

// Replaces the root layout when it fails, so no app styles or fonts: inline only.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#090911",
          color: "#f4f1ea",
          font: "16px/1.5 system-ui, sans-serif",
          padding: "4rem 1rem",
        }}
      >
        <title>tcgmart</title>
        <main style={{ maxWidth: "44ch" }}>
          <h1 style={{ fontSize: "2rem", margin: "0 0 1rem" }}>
            Something went wrong.
          </h1>
          <p>It&apos;s on our side, not yours. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: "3rem",
              padding: "0 1.25rem",
              font: "inherit",
              fontWeight: 600,
              color: "inherit",
              background: "transparent",
              border: "1.5px solid currentColor",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

"use client";

/** Last-resort boundary (root layout failed): self-contained, inline styles only. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbfdfd", color: "#1d2a33", margin: 0 }}>
        <title>NazarAI: something went wrong</title>
        <main style={{ maxWidth: 480, margin: "96px auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>NazarAI could not load</h1>
          <p style={{ color: "#5b6b78" }}>Please check your connection and try again.</p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 24, padding: "10px 18px", borderRadius: 10, border: 0, background: "#0f766e", color: "white", fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

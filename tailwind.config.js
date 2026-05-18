/** @type {import('tailwindcss').Config} */
// Mirrors the "Sweet Sundae" palette from the ordering app so both
// sites feel like the same brand. If you tweak colors in the main app,
// keep this file in sync.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rollo: {
          // Surfaces
          paper: "#FBE4ED",
          "paper-soft": "#FFF1F5",
          "paper-warm": "#FFF5E8",
          card: "#FFFFFF",

          // Inks
          ink: "#2A1722",
          "ink-soft": "rgba(42,23,34,0.62)",
          "ink-muted": "rgba(42,23,34,0.40)",
          "ink-line": "rgba(42,23,34,0.10)",

          // Pink family (primary)
          pink: "#EC1E79",
          "pink-deep": "#B81560",
          "pink-soft": "#FCD3E1",
          "pink-rose": "#F5A6BD",

          // Rose family
          rose: "#B85F76",
          "rose-deep": "#7E3F52",

          // Secondary accents
          green: "#A6CE39",
          "green-deep": "#6A8B19",
          orange: "#F58220",
          butter: "#FCD86F",
          "butter-deep": "#F5C84C",
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        brand: ['"Bagel Fat One"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        "rollo-card": "0 6px 18px -10px rgba(184,21,96,0.18)",
        "rollo-pink": "0 6px 18px -4px rgba(236,30,121,0.45)",
        "rollo-fab": "0 14px 30px -6px rgba(236,30,121,0.55)",
        "rollo-rose": "0 12px 24px -10px rgba(126,63,82,0.45)",
        "rollo-soft": "0 2px 6px rgba(42,23,34,0.06)",
      },
      borderRadius: {
        "rollo-card": "22px",
        "rollo-hero": "26px",
        "rollo-ticket": "28px",
      },
    },
  },
  plugins: [],
};

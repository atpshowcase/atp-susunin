import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0E0E10",
        surface: "#16161A",
        "surface-2": "#1E1E23",
        "surface-3": "#26262C",
        border: "#29292F",
        text: "#F2F1ED",
        muted: "#8B8B93",
        accent: "#F2A93B",
        "accent-soft": "rgba(242, 169, 59, 0.14)",
        danger: "#E5484D",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "IBM Plex Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        wide2: "0.08em",
      },
      keyframes: {
        "clip-in": {
          "0%": { transform: "scaleX(0.9)", opacity: "0.4" },
          "100%": { transform: "scaleX(1)", opacity: "1" },
        },
      },
      animation: {
        "clip-in": "clip-in 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Brand palette — values live in globals.css (:root --pp-*).
      colors: {
        pp: {
          primary: "rgb(var(--pp-primary) / <alpha-value>)",
          "primary-strong": "rgb(var(--pp-primary-strong) / <alpha-value>)",
          accent: "rgb(var(--pp-accent) / <alpha-value>)",
          muted: "rgb(var(--pp-muted) / <alpha-value>)",
          line: "rgb(var(--pp-line) / <alpha-value>)",
          tint: "rgb(var(--pp-tint) / <alpha-value>)",
          "tint-hover": "rgb(var(--pp-tint-hover) / <alpha-value>)",
          soft: "rgb(var(--pp-soft) / <alpha-value>)",
          hover: "rgb(var(--pp-hover) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      animation: {
        "pop-in": "pop-in 0.3s ease-out",
        "wiggle": "wiggle 0.6s ease-in-out",
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-6deg)" },
          "75%": { transform: "rotate(6deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

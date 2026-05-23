import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text-primary)",
        lime: "var(--lime)",
        pastel: {
          blue: "var(--pastel-blue)",
          pink: "var(--pastel-pink)",
          green: "var(--pastel-green)",
          yellow: "var(--pastel-yellow)",
        },
        brutal: {
          black: "var(--brutal-black)",
          white: "var(--brutal-white)",
        },
        panel: "var(--panel)",
        danger: "var(--danger)",
        warning: "var(--warning)",
      },
      fontFamily: {
        display: ["var(--font-anton)"],
        body: ["var(--font-playfair)"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px var(--brutal-black)",
        "brutal-lg": "8px 8px 0px 0px var(--brutal-black)",
        "brutal-active": "2px 2px 0px 0px var(--brutal-black)",
        inset: "inset 0 2px 4px 0 rgba(0,0,0,0.06)",
      },
      borderWidth: {
        brutal: "3px",
      }
    }
  },
  plugins: []
};

export default config;

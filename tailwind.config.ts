import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        panel: "var(--panel)",
        border: "var(--border)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      },
      boxShadow: {
        brutal: "8px 8px 0 0 rgba(var(--shadow-color), 0.95)",
        inset: "inset 0 0 0 1px rgba(var(--shadow-color), 0.12)"
      },
      borderRadius: {
        xl: "1.5rem",
        "2xl": "2rem"
      },
      animation: {
        "pulse-line": "pulse-line 1.6s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-in-out both"
      },
      keyframes: {
        "pulse-line": {
          "0%, 100%": { transform: "scaleX(0.98)", opacity: "0.55" },
          "50%": { transform: "scaleX(1)", opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;

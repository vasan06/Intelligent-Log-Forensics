/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cyber: {
          950: "#060911",
          900: "#0b0f19",
          850: "#101624",
          800: "#151d30",
          700: "#1e2942",
          600: "#2d3c5e",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          subtle: "var(--accent-subtle)",
        },
        severity: {
          critical: "var(--critical)",
          high: "var(--high)",
          medium: "var(--medium)",
          low: "var(--low)",
          ok: "var(--ok)",
          info: "var(--info)",
        },
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px rgba(56, 139, 253, 0.35)",
        "glow-crimson": "0 0 20px rgba(248, 81, 73, 0.35)",
        "glow-emerald": "0 0 20px rgba(63, 185, 80, 0.35)",
        "glow-amber": "0 0 20px rgba(227, 179, 65, 0.35)",
      },
    },
  },
  plugins: [],
};

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
        ground: "var(--ground)",
        cosmic: "var(--cosmic)",
        raised: "var(--raised)",
        line: "var(--line)",
        hover: "var(--hover)",
        "hover-strong": "var(--hover-strong)",
        fg: "var(--fg)",
        dim: "var(--dim)",
        scrim: "var(--scrim)",
        accent: {
          DEFAULT: "var(--accent)",
          ink: "var(--accent-ink)",
          soft: "var(--accent-soft)",
          hover: "var(--accent-hover)",
        },
      },
      boxShadow: {
        press: "0 1px 2px var(--press-shade)",
        surface: "var(--shadow-surface)",
        island: "inset 0 0 0 1px var(--line), 0 1px 2px var(--press-shade)",
      },
      transitionTimingFunction: {
        trail: "cubic-bezier(0.2, 0, 0, 1)",
      },
      fontFamily: {
        sans: ["Gilroy", "ui-sans-serif", "system-ui", '"Segoe UI"', "sans-serif"],
        mono: ['"Cascadia Mono"', '"IBM Plex Mono"', "Consolas", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}

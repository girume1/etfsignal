/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#FF7637",
          teal:   "#00FFA7",
          dark:   "#06080B",
          panel:  "#04101B",
          card:   "#0B0B0B",
          border: "rgba(255,255,255,0.07)",
        }
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    }
  },
  plugins: [],
}

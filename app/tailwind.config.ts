import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Verdana", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;


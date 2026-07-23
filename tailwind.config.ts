import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          50: "#FBFBFB",
          100: "#F4F6F5",
          200: "#DCDFDD",
          300: "#BCC0BE",
        },
        ink: {
          50: "#F2F3F3",
          100: "#DFE1E0",
          200: "#BBBEBD",
          300: "#919694",
          400: "#5A615E",
          500: "#2C3531",
          600: "#242B28",
          700: "#1C221F",
          800: "#141816",
        },
        sage: {
          50: "#C9D4CC",
          100: "#ABBDAF",
          200: "#95AB9B",
          300: "#87A08D",
          400: "#79907F",
          500: "#6A7E70",
          600: "#2F6A51",
        },
      },
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
        cormorant: ["Cormorant Garamond", "serif"],
        dm: ["DM Sans", "sans-serif"],
        maru: ["M PLUS Rounded 1c", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e7ff",
          200: "#bcd5ff",
          300: "#8ebaff",
          400: "#5993ff",
          500: "#326bff",
          600: "#1b4af5",
          700: "#1438e1",
          800: "#172fb6",
          900: "#192e8f",
        },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Silver Fern Education Consultants — deep forest green (thesfedu.com).
        brand: {
          50: "#eef6f0",
          100: "#d6e9db",
          200: "#aed3b8",
          300: "#7fb78f",
          400: "#4f9667",
          500: "#357d4a",
          600: "#276439",
          700: "#21512f",
          800: "#1c4127",
          900: "#163420",
        },
      },
    },
  },
  plugins: [],
};

export default config;

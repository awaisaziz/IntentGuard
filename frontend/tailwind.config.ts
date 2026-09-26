import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#3A8A8C",
          light: "#52B0B2",
          dark: "#2A6667"
        },
        status: {
          draft: "#94a3b8",
          validated: "#3b82f6",
          approved: "#8b5cf6",
          shipped: "#f59e0b",
          verified: "#10b981"
        }
      },
    },
  },
  plugins: [],
};
export default config;

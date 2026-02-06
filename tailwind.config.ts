
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          navy: "#0f1e2b",
          blue: "#2f80ed",
          accent: "#56ccf2",
          slate: "#111827"
        },
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out',
      },
      boxShadow: {
        'brand-md': '0 10px 20px -5px rgba(47,128,237,0.2), 0 6px 8px -6px rgba(17,24,39,0.2)'
      }
    },
  },
  plugins: [],
};

export default config;


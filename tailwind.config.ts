import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-barlow)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        athletic: "0.12em",
        tightest: "-0.04em",
      },
      colors: {
        brand: {
          navy: "#0a2540",
          navyLight: "#ffffff",
          navyDark: "#0a2540",
          gold: "#635bff",
          goldLight: "#7c75ff",
          goldPale: "#eef2ff",
          surface: "#f6f9fc",
          border: "#e6ebf1",
        },
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(99, 91, 255, 0.35)",
        "glow-soft": "0 0 80px -20px rgba(99, 91, 255, 0.2)",
        card: "0 2px 8px rgba(50, 50, 93, 0.06), 0 24px 48px -12px rgba(50, 50, 93, 0.1)",
        "card-hover": "0 4px 12px rgba(50, 50, 93, 0.08), 0 32px 64px -16px rgba(50, 50, 93, 0.12)",
        panel: "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 32px -8px rgba(50,50,93,0.08)",
        lift: "0 40px 80px -24px rgba(10, 37, 64, 0.2)",
        premium: "0 0 0 1px rgba(99,91,255,0.12), 0 30px 60px -12px rgba(50,50,93,0.12)",
        brutal: "4px 4px 0 rgba(99, 91, 255, 0.25)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 70% 55% at 10% 20%, rgba(99,91,255,0.12), transparent 55%), radial-gradient(ellipse 50% 45% at 90% 10%, rgba(224,231,255,0.8), transparent 50%)",
        "gold-line":
          "linear-gradient(90deg, transparent, rgba(99,91,255,0.5) 50%, transparent)",
        "gold-sweep":
          "linear-gradient(105deg, transparent 40%, rgba(99,91,255,0.06) 50%, transparent 60%)",
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        marquee: "marquee 28s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

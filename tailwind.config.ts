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
          navy: "#0c1f3d",
          navyLight: "#122a4a",
          navyDark: "#081428",
          gold: "#c9a227",
          goldLight: "#e5c04a",
          goldPale: "#f5ecd4",
        },
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(201, 162, 39, 0.5)",
        "glow-soft": "0 0 80px -20px rgba(201, 162, 39, 0.25)",
        card: "0 2px 8px rgba(12, 31, 61, 0.04), 0 24px 48px -12px rgba(12, 31, 61, 0.1)",
        "card-hover": "0 4px 12px rgba(12, 31, 61, 0.06), 0 32px 64px -16px rgba(12, 31, 61, 0.14)",
        panel: "0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 48px -24px rgba(0,0,0,0.45)",
        lift: "0 40px 80px -24px rgba(8, 20, 40, 0.55)",
        premium: "0 0 0 1px rgba(201,162,39,0.15), 0 32px 64px -24px rgba(12,31,61,0.2)",
        brutal: "4px 4px 0 rgba(201, 162, 39, 0.35)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 70% 55% at 10% 20%, rgba(201,162,39,0.14), transparent 55%), radial-gradient(ellipse 50% 45% at 90% 10%, rgba(255,255,255,0.07), transparent 50%)",
        "gold-line":
          "linear-gradient(90deg, transparent, rgba(201,162,39,0.6) 50%, transparent)",
        "gold-sweep":
          "linear-gradient(105deg, transparent 40%, rgba(201,162,39,0.08) 50%, transparent 60%)",
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

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    {
      pattern:
        /sources-enrichment-(flow-branch|engine-ring|engine-pill|engine-check|engine-scanned|badge)--[0-4]/,
    },
    "sources-enrichment--active",
    {
      pattern:
        /agent-promo-(scenario|input-text|suggestion)--[1-3]/,
    },
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
          surface: "#f8fafc",
          border: "#e2e8f0",
        },
        /* Apple-tema inne i /app (theme-apple.css) */
        app: {
          ink: "#1c1c1e",
          surface: "#2c2c2e",
          surfaceRaised: "#3a3a3c",
          text: "#f5f5f7",
          muted: "#98989d",
          accent: "#0a84ff",
          accentLight: "#409cff",
        },
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(201, 162, 39, 0.5)",
        "glow-soft": "0 0 80px -20px rgba(201, 162, 39, 0.25)",
        card: "0 2px 8px rgba(12, 31, 61, 0.04), 0 24px 48px -12px rgba(12, 31, 61, 0.1)",
        "card-hover": "0 4px 12px rgba(12, 31, 61, 0.06), 0 32px 64px -16px rgba(12, 31, 61, 0.14)",
        panel: "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 32px -8px rgba(12,31,61,0.08)",
        lift: "0 40px 80px -24px rgba(8, 20, 40, 0.55)",
        premium: "0 0 0 1px rgba(201,162,39,0.15), 0 32px 64px -24px rgba(12,31,61,0.2)",
        brutal: "4px 4px 0 rgba(201, 162, 39, 0.35)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 70% 55% at 10% 20%, rgba(201,162,39,0.14), transparent 55%), radial-gradient(ellipse 50% 45% at 90% 10%, rgba(245,236,212,0.8), transparent 50%)",
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
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-50%, 0, 0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

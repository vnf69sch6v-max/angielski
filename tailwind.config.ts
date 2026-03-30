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
        bg: {
          DEFAULT: "#0A0A0B",
          surface: "#141416",
          "surface-hover": "#1C1C1F",
        },
        border: {
          DEFAULT: "#27272A",
        },
        text: {
          primary: "#FAFAFA",
          secondary: "#A1A1AA",
        },
        accent: {
          DEFAULT: "#6366F1",
          hover: "#818CF8",
          muted: "rgba(99,102,241,0.15)",
        },
        success: {
          DEFAULT: "#22C55E",
          muted: "rgba(34,197,94,0.15)",
        },
        error: {
          DEFAULT: "#EF4444",
          muted: "rgba(239,68,68,0.15)",
        },
        warning: {
          DEFAULT: "#F59E0B",
          muted: "rgba(245,158,11,0.15)",
        },
        domain: {
          finance: "#3B82F6",
          legal: "#8B5CF6",
          smalltalk: "#F97316",
          tech: "#06B6D4",
        },
      },
      fontFamily: {
        heading: ["var(--font-instrument-serif)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

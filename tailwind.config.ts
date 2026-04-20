import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // ─── Iran flag palette ─────────────────────────────────
        iran: {
          green: "#009B3A",       // flag green (primary)
          "deep-green": "#006B2D", // hover / depth
          "bright-green": "#00D965", // dark mode primary
          white: "#FFFFFF",
          red: "#C8102E",          // flag red (alerts)
          "red-bright": "#E4192C",
          gold: "#D4A843",         // sun / heritage gold
          saffron: "#F4B43C",      // bright accent gold
        },
        // ─── Persian heritage palette ──────────────────────────
        persia: {
          turquoise: "#20B2AA",   // secondary accent
          "turquoise-deep": "#157B76",
          indigo: "#2E3B5C",      // deep/professional
          terracotta: "#B85C38",  // warm heritage accent
          clay: "#9C4A2F",
          ivory: "#FAF6E8",       // warm off-white
          sand: "#E8DCC0",        // sandy beige
        },
        // ─── Design system semantic tokens (CSS vars) ──────────
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        surface: "hsl(var(--card))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
        farsi: ["var(--font-vazirmatn)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 6vw, 3.75rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg": ["clamp(2rem, 5vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-md": ["clamp(1.75rem, 4vw, 2.25rem)", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" }],
      },
      boxShadow: {
        "iran-green": "0 4px 12px rgba(0, 155, 58, 0.18)",
        "iran-green-lg": "0 10px 28px rgba(0, 155, 58, 0.22)",
        "iran-gold": "0 4px 12px rgba(212, 168, 67, 0.22)",
        "iran-gold-lg": "0 10px 28px rgba(212, 168, 67, 0.28)",
        "iran-red": "0 4px 12px rgba(200, 16, 46, 0.18)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 155, 58, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 155, 58, 0.4)" },
        },
        "gold-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(212, 168, 67, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(212, 168, 67, 0.5)" },
        },
        "sun-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "sun-spin-reverse": {
          "0%": { transform: "rotate(360deg) scale(0.78)" },
          "100%": { transform: "rotate(0deg) scale(0.78)" },
        },
        "sun-glow-pulse": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.95", transform: "scale(1.08)" },
        },
        "arabesque-fade": {
          "0%, 100%": { opacity: "0", transform: "scale(0.95) rotate(0deg)" },
          "50%": { opacity: "0.4", transform: "scale(1.02) rotate(2deg)" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1) translate(0, 0)" },
          "50%": { transform: "scale(1.08) translate(-1.5%, 1%)" },
          "100%": { transform: "scale(1) translate(0, 0)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "float": "float 4s ease-in-out infinite",
        "bounce-subtle": "bounce-subtle 0.4s ease-in-out",
        "glow-pulse": "glow-pulse 2.4s ease-in-out infinite",
        "gold-pulse": "gold-pulse 2.4s ease-in-out infinite",
        "sun-spin": "sun-spin 60s linear infinite",
        "sun-spin-reverse": "sun-spin-reverse 90s linear infinite",
        "sun-glow-pulse": "sun-glow-pulse 4s ease-in-out infinite",
        "arabesque-fade": "arabesque-fade 9s ease-in-out infinite",
        "ken-burns": "ken-burns 40s ease-in-out infinite",
        "shimmer": "shimmer 1.5s ease-in-out infinite",
        "scale-in": "scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
      backgroundImage: {
        "gradient-iran": "linear-gradient(135deg, #006B2D 0%, #009B3A 50%, #006B2D 100%)",
        "gradient-iran-gold": "linear-gradient(135deg, #006B2D 0%, #009B3A 40%, #D4A843 100%)",
        "gradient-hero": "linear-gradient(160deg, #003D1A 0%, #006B2D 40%, #009B3A 100%)",
        "gradient-sun": "radial-gradient(circle at center, #F4E5B8 0%, #F4B43C 45%, #D4A843 100%)",
        "gradient-persia": "linear-gradient(135deg, #2E3B5C 0%, #20B2AA 50%, #D4A843 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

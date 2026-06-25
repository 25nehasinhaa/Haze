export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  safelist: [
    // opacity variants that JIT misses for custom colors
    "bg-white/3","bg-white/4","bg-white/6","bg-white/8",
    "bg-accent/6","bg-accent/8","bg-accent/12",
    "bg-emerald-500/8","bg-red-500/8","bg-amber-500/8",
    "border-white/6","border-white/8","border-white/12","border-white/15",
    "border-accent/15","border-accent/20","border-accent/25","border-accent/30","border-accent/50",
    "text-white/60","text-white/70","text-white/80",
    "shadow-glow","shadow-soft",
    "rotate-90","-translate-y-0.5","-translate-y-1",
    "bg-background","bg-secondary",
    "grid-cols-[1fr_380px]","grid-cols-[1.4fr_1fr]",
  ],
  theme: {
    extend: {
      colors: {
        accent: "rgba(255,109,41,<alpha-value>)",
        secondary: "rgba(69,48,39,<alpha-value>)",
        background: "#161316",
        neutral: "#BABABA",
        success: "#4ADE80",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      fontFamily: {
        sans: ["Neue Montreal","General Sans","Satoshi","Inter","system-ui","sans-serif"],
      },
      borderRadius: { premium: "24px" },
      boxShadow: {
        glow: "0 24px 80px rgba(255,109,41,0.18)",
        soft: "0 20px 60px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

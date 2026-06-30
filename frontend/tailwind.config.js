export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  safelist: [
    // opacity variants
    "bg-white/5","bg-white/10","bg-white/15","bg-white/20",
    "bg-black/70","bg-black/80","bg-black/50",
    "bg-accent/10","bg-accent/15","bg-accent/20",
    "bg-emerald-500/10","bg-emerald-500/15",
    "bg-red-500/10","bg-red-500/15",
    "bg-amber-500/10","bg-amber-500/15",
    "border-white/5","border-white/10","border-white/15","border-white/20",
    "border-accent/20","border-accent/25","border-accent/30","border-accent/50",
    "border-emerald-500/25","border-red-500/20","border-amber-500/20","border-orange-500/25",
    // neutral shades (custom color)
    "text-neutral-400","text-neutral-500","text-neutral-600","text-neutral-700","text-neutral-800",
    "bg-neutral-800","bg-neutral-900",
    // spacing fractionals
    "gap-1.5","gap-2.5","gap-3.5",
    "p-1.5","px-1.5","py-1.5",
    "h-1.5","w-1.5",
    "mb-1.5","mt-0.5","mt-1.5","mr-1","ml-1",
    "rounded-[20px]","rounded-[24px]","rounded-[14px]","rounded-[16px]","rounded-[12px]",
    // leading
    "leading-[0.9]","leading-[0.92]","leading-[0.95]",
    // colors
    "text-purple-400","bg-purple-400","border-purple-400",
    "text-violet-400",
    // shadow
    "shadow-glow","shadow-soft",
    // other
    "rotate-90","backdrop-blur-sm","backdrop-blur-xl",
    "translate-x-1/2","-translate-x-1/2","translate-y-1/2","-translate-y-1/2",
    "bg-background",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#FF6D29",
          10: "rgba(255,109,41,0.1)",
          15: "rgba(255,109,41,0.15)",
          20: "rgba(255,109,41,0.2)",
        },
        secondary: "#453027",
        background: "#080608",
        neutral: {
          400: "#BABABA",
          500: "#888888",
          600: "#666666",
          700: "#444444",
          800: "#222222",
        },
        success: "#4ADE80",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      fontFamily: {
        sans: ["Inter","system-ui","sans-serif"],
      },
      borderRadius: { premium: "24px" },
      boxShadow: {
        glow: "0 24px 80px rgba(255,109,41,0.22)",
        soft: "0 20px 60px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

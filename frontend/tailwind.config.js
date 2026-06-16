export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#FF6D29",
        secondary: "#453027",
        background: "#161316",
        neutral: "#BABABA",
        white: "#FFFFFF",
        success: "#4ADE80",
        warning: "#F59E0B",
        error: "#EF4444"
      },
      fontFamily: {
        sans: ["Neue Montreal", "General Sans", "Satoshi", "Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        premium: "24px"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(255, 109, 41, 0.18)",
        soft: "0 20px 60px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
};


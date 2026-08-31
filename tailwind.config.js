/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/views/**/*.html",
    "./src/public/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        coral: {
          50: "#fff1ee",
          100: "#ffe1da",
          400: "#ff8a70",
          500: "#ff6b4a",
          600: "#f0502e",
        },
        status: {
          online: "#22c55e",
          degraded: "#f59e0b",
          offline: "#ef4444",
        },
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.4)", opacity: "0.6" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
      
    },
  },
  plugins: [],
};

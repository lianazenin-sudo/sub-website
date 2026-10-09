/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#111111",
        accent: "#A4A1FF",
        muted: "#888888",
        panel: "#323232",
      },
    },
  },
  plugins: [],
};

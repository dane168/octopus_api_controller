/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Price level colors
        price: {
          'very-cheap': '#22c55e',   // Green
          'cheap': '#84cc16',         // Lime
          'normal': '#eab308',        // Yellow
          'expensive': '#f97316',     // Orange
          'very-expensive': '#ef4444', // Red
        },
      },
    },
  },
  plugins: [],
};

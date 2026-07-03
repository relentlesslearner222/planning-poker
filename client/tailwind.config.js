/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#428ca8',
          dark: '#2d6a82',
          light: '#e8f4f8',
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f7', 100: '#d5ecec', 200: '#a9d7d8', 300: '#74bcbe',
          400: '#4a9fa2', 500: '#2f8285', 600: '#256a6d', 700: '#1f5658',
          800: '#1b4547', 900: '#163839',
        },
        accent: { 400: '#f4a07a', 500: '#ee7f52', 600: '#d9653a' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

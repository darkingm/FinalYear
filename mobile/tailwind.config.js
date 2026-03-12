/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#f0b90b',
        'primary-dark': '#e6a800',
        background: '#0c0e14',
        card: '#131722',
        border: '#1e2130',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
};

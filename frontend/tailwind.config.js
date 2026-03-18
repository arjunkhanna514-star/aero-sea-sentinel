/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
        body:    ['Nunito Sans', 'sans-serif'],
      },
      colors: {
        sentinel: {
          void:    '#04060d',
          deep:    '#070b14',
          surface: '#0b1120',
          panel:   '#0f1828',
          raised:  '#141f30',
        },
      },
    },
  },
  plugins: [],
};

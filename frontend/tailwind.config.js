/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Тёмная тема - тёмно-фиолетовый
        dark: {
          bg: '#1a0b2e',
          surface: '#2d1b4e',
          hover: '#3d2b5e',
          border: '#4d3b6e',
        },
        // Светлая тема - светло-розовый и белый
        light: {
          bg: '#ffffff',
          surface: '#fef3f8',
          hover: '#fce7f3',
          border: '#f9d5e8',
        },
        // Акцентный цвет - розовый
        accent: {
          DEFAULT: '#ec4899',
          hover: '#db2777',
          light: '#f9a8d4',
        },
        // Фиолетовый для кнопок в светлой теме
        purple: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          light: '#a78bfa',
        },
      },
    },
  },
  plugins: [],
}

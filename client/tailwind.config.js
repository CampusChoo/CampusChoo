/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        'dm-sans': ['DM Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e8f5e9',
          100: '#c8e6c9',
          500: '#2d7a45',
          600: '#1b5e20',
          700: '#155218',
        },
        accent: {
          500: '#e65c00',
          600: '#bf4d00',
        },
        choo: {
          bg:     '#080706',
          orange: '#F4521E',
          'orange-light': '#ff8c42',
        },
      },
      keyframes: {
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        ping: 'ping 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
};

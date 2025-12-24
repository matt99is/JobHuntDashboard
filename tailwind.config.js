export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#B8432F',
          light: '#D4654F',
          dark: '#8C3224',
        },
        cream: {
          DEFAULT: '#FFFCF7',
          dark: '#F8F5F0',
          darker: '#F0EBE3',
        },
        border: {
          light: '#E5DED3',
          medium: '#D4CCC0',
          dark: '#B8AFA3',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      boxShadow: {
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

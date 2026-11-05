import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#090909',
        graphite: '#141414',
        panel: '#101010',
        line: '#262626',
        gold: '#D4AF37',
        paper: '#F5F5F5',
        muted: '#999999',
        positive: '#22C55E',
        negative: '#EF4444',
        attention: '#EAB308',
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,.28), 0 12px 36px rgba(0,0,0,.24)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
} satisfies Config

import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // New design system — Finance Banking inspired
        ink: '#F8FAF9',          // page background — soft off-white
        graphite: '#FFFFFF',      // card/surface background — pure white
        panel: '#F2F4F3',         // subtle section backgrounds
        line: '#E8ECEB',          // borders — very light
        // Brand
        gold: '#C8FF00',          // lime neon accent (CTA, highlights)
        'gold-dark': '#1A3C34',   // dark teal — primary action text on gold
        // Text
        paper: '#0D1F1A',         // primary text — near-black with green tint
        muted: '#3D5048',         // secondary text — darker for legibility
        // Status
        positive: '#00B87A',      // green
        negative: '#EF4444',      // red
        attention: '#F59E0B',     // amber
        // Teal palette
        teal: '#1A3C34',          // dark teal (sidebar, heavy elements)
        'teal-mid': '#2D5E4E',    // medium teal
      // Also update the teal palette secondary text
        'teal-light': '#E6F4EF',  // very light teal (hover bg, chips)
        'teal-border': '#C2DDD5', // teal-tinted border
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,.10), 0 12px 32px rgba(0,0,0,.06)',
        lime: '0 0 0 1px rgba(200,255,0,.4), 0 8px 24px rgba(200,255,0,.15)',
      },
      borderRadius: {
        card: '18px',
        chip: '100px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'zoom-in': {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config

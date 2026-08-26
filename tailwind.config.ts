import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#ffffff',
        primary: '#FF6B2B',
        secondary: '#7C3AED',
        accent: '#00D9FF',
        success: '#2ECC71',
        danger: '#FF3B30',
        // v2 brand — light/clean, matches the marketing site
        paper: '#FFFDF9',
        ink: '#1A1A1A',
        brand: '#F26B21',
      },
    },
  },
  plugins: [],
}
export default config

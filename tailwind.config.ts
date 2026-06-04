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
      },
    },
  },
  plugins: [],
}
export default config

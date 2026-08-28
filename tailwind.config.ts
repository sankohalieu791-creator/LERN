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
        // v2 brand — var-backed so light/dark (see globals.css tokens,
        // switched via [data-theme]) apply with zero changes to existing
        // bg-paper / text-ink / bg-brand usage across the app.
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        brand: 'var(--brand)',
        'brand-hover': 'var(--brand-hover)',
        surface: 'var(--surface)',
        'surface-subtle': 'var(--surface-subtle)',
        'surface-muted': 'var(--surface-muted)',
        edge: 'var(--border)',
        'edge-subtle': 'var(--border-subtle)',
        'edge-input': 'var(--border-input)',
        'ink-secondary': 'var(--text-secondary)',
        'ink-tertiary': 'var(--text-tertiary)',
        'ink-quaternary': 'var(--text-quaternary)',
        'ink-body': 'var(--text-body)',
        'success-text': 'var(--success-text)',
        'success-bg': 'var(--success-bg)',
        'success-hover': 'var(--success-hover)',
        'danger-text': 'var(--danger-text)',
        'danger-bg': 'var(--danger-bg)',
        'danger-hover': 'var(--danger-hover)',
        'warning-text': 'var(--warning-text)',
        'warning-bg': 'var(--warning-bg)',
        'warning-bg-soft': 'var(--warning-bg-soft)',
        'accent-bg': 'var(--accent-bg)',
        'accent-bg-soft': 'var(--accent-bg-soft)',
        'success-solid': 'var(--success-solid)',
        'success-solid-hover': 'var(--success-solid-hover)',
        'danger-solid': 'var(--danger-solid)',
        'danger-solid-hover': 'var(--danger-solid-hover)',
        'warning-solid': 'var(--warning-solid)',
      },
    },
  },
  plugins: [],
}
export default config

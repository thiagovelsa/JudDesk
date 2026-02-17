/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Use CSS variables with <alpha-value> support (bg-primary/10, border-primary/30, etc).
        primary: 'rgb(var(--rgb-primary) / <alpha-value>)',
        'primary-dark': 'rgb(var(--rgb-primary-dark) / <alpha-value>)',
        'background-light': '#f6f7f8',
        'background-dark': 'rgb(var(--rgb-bg-primary) / <alpha-value>)',
        'surface-dark': 'rgb(var(--rgb-bg-secondary) / <alpha-value>)',
        'surface-highlight': 'rgb(var(--rgb-bg-tertiary) / <alpha-value>)',
        'border-dark': 'rgb(var(--rgb-border-default) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
}

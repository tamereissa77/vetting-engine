/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: 'rgb(var(--cyber-dark) / <alpha-value>)',
          gray: 'rgb(var(--cyber-gray) / <alpha-value>)',
          slate: 'rgb(var(--cyber-slate) / <alpha-value>)',
          cyan: 'rgb(var(--cyber-cyan) / <alpha-value>)',
          magenta: 'rgb(var(--cyber-magenta) / <alpha-value>)',
          green: 'rgb(var(--cyber-green) / <alpha-value>)',
          yellow: 'rgb(var(--cyber-yellow) / <alpha-value>)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Space Mono', 'ui-monospace', 'monospace'],
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgb(var(--cyber-cyan) / 0.25)',
        'cyan-glow-intense': '0 0 25px rgb(var(--cyber-cyan) / 0.5)',
        'magenta-glow': '0 0 15px rgb(var(--cyber-magenta) / 0.25)',
        'magenta-glow-intense': '0 0 25px rgb(var(--cyber-magenta) / 0.5)',
        'yellow-glow': '0 0 15px rgb(var(--cyber-yellow) / 0.25)',
      }
    },
  },
  plugins: [],
}

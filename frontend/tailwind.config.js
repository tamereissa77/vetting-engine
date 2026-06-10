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
          dark: '#0a0e17',
          gray: '#0f172a',
          slate: '#1e293b',
          cyan: '#00f2fe',
          magenta: '#d946ef',
          green: '#10b981',
          yellow: '#f59e0b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Space Mono', 'ui-monospace', 'monospace'],
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(0, 242, 254, 0.25)',
        'cyan-glow-intense': '0 0 25px rgba(0, 242, 254, 0.5)',
        'magenta-glow': '0 0 15px rgba(217, 70, 239, 0.25)',
        'magenta-glow-intense': '0 0 25px rgba(217, 70, 239, 0.5)',
      }
    },
  },
  plugins: [],
}

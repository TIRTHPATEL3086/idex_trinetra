/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core verdict colours (Strict SIH specification: Never red)
        attributed: '#10b981', // emerald-500
        'attributed-glow': '#059669',
        probable: '#f59e0b', // amber-500
        'probable-glow': '#d97706',
        inconclusive: '#64748b', // slate-500
        'inconclusive-glow': '#475569',

        // Cyber command console background and surface layers
        brand: {
          50: '#ecfeff',
          100: '#cffafe',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        panel: '#0c121e',
        'panel-border': '#1e293b',
        'panel-accent': '#162238',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        scan: 'scan 2.5s ease-in-out infinite alternate',
        radar: 'radar 3s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        'glow-attributed': '0 0 25px -5px rgba(16, 185, 129, 0.3)',
        'glow-probable': '0 0 25px -5px rgba(245, 158, 11, 0.3)',
        'glow-inconclusive': '0 0 25px -5px rgba(100, 116, 139, 0.25)',
        'glow-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.25)',
      },
    },
  },
  plugins: [],
};

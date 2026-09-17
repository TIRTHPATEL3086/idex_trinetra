/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Lime accent — the signature colour of the design.
        lime: {
          DEFAULT: '#c9f24d',
          soft: '#eef9c7', // pale lime fill for pills / active tints
          bright: '#d4f55f',
          deep: '#b4e02c', // hover
        },
        // Dark olive/army green — the outer canvas the white app sits on.
        olive: {
          DEFAULT: '#3a3d1a',
          dark: '#2e3113',
        },
        // Near-black for pills, dark buttons and the stats panel.
        night: {
          DEFAULT: '#141410',
          soft: '#1d1e15',
        },
        ink: {
          DEFAULT: '#16160f', // headings
          muted: '#6f7268', // secondary text
          faint: '#a7a99e', // tertiary
        },
        line: '#ecebe4', // hairline borders on white
        pending: '#5b93de', // blue status pill
        // Verdict colours stay semantic (never red for a verdict).
        attributed: '#4d9d2a', // green (aligns with the lime family)
        probable: '#d99a1c', // amber
        inconclusive: '#6b7280', // slate
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'ui-rounded', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 20, 16, 0.04), 0 10px 30px -18px rgba(20, 20, 16, 0.25)',
        panel: '0 20px 60px -30px rgba(20, 20, 16, 0.5)',
        app: '0 30px 80px -40px rgba(0, 0, 0, 0.6)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};

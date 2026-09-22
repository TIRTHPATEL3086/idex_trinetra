/** @type {import('tailwindcss').Config} */

/**
 * Design tokens ported from the nomu.store reference.
 *
 * The values below are the ones the reference actually ships in its
 * `:root` block — warm cream canvas, coral primary, deep navy ink, a
 * hairline grey border and a very large corner radius. Only the verdict
 * colours are ours: they stay semantic, and never coral, so an accent
 * button can never read as a forensic conclusion.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Coral primary — the signature colour (reference: --primary #ff7448).
        accent: {
          DEFAULT: '#ff7448',
          bright: '#ff8d69', // --highlight-1
          warm: '#ffa88d', // --highlight-2
          soft: '#ffc8b7', // --highlight-3
          tint: '#fff0ea', // palest wash for pills / active rows
          deep: '#e85c2e', // hover / pressed
          fg: '#fbfbfb', // --primary-foreground
        },
        // Warm cream page canvas (reference: --background #fff9f6).
        canvas: {
          DEFAULT: '#fff9f6',
          paper: '#f7f5ee', // --paper-cream
        },
        // Deep navy-black used for dark surfaces and solid buttons.
        noir: {
          DEFAULT: '#0f151d', // --foreground / --background-dark-ish
          deep: '#0d1117', // --background-dark
          soft: '#1b232e', // --dark-surface
        },
        ink: {
          DEFAULT: '#0f151d', // headings
          muted: '#737373', // --muted-foreground
          faint: '#a1a1a1', // --ring, tertiary text
        },
        line: '#e5e5e5', // --border / --input
        muted: '#f5f5f5', // --muted surface
        // Pale blue secondary, used sparingly for informational states.
        info: {
          DEFAULT: '#d3e1ff', // --secondary
          ink: '#2f4d8f',
        },
        // Verdict colours stay semantic (never coral, never red).
        //
        // Each carries three cuts: DEFAULT for text on white, `bright` for the
        // same meaning on a dark surface (where DEFAULT would go muddy), and
        // `tint` for the pale fill behind it.
        attributed: { DEFAULT: '#00bb7f', deep: '#007956', bright: '#5ee9b5', tint: '#d0fae5' },
        probable: { DEFAULT: '#a16207', deep: '#6b3f05', bright: '#e8b04b', tint: '#fef3c6' },
        inconclusive: { DEFAULT: '#737373', deep: '#4a4a4a', bright: '#c4c4c4', tint: '#f5f5f5' },
        pending: { DEFAULT: '#4a6fc4', deep: '#2f4d8f', bright: '#9dbcff', tint: '#d3e1ff' },
        // Destructive actions and hard failures only — never a verdict.
        danger: { DEFAULT: '#e40014', deep: '#a3000f', bright: '#ff7b86', tint: '#ffe5e7' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 21, 29, 0.04), 0 10px 30px -18px rgba(15, 21, 29, 0.22)',
        panel: '0 20px 60px -30px rgba(15, 21, 29, 0.45)',
        app: '0 30px 90px -45px rgba(15, 21, 29, 0.35)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        // The reference's signature radius: 1.5rem on mobile, 3.125rem up.
        panel: '1.5rem',
        'panel-lg': '3.125rem',
      },
      letterSpacing: {
        tight: '-0.025em',
      },
    },
  },
  plugins: [],
};

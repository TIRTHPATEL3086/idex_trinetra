/** @type {import('tailwindcss').Config} */

/**
 * Design tokens taken from the Chromia identity system.
 *
 * The eight hue ramps below are that system's own published values, each with
 * a 500 and an 800 step. The semantic names above them (canvas, ink, accent,
 * and the verdict colours) are ours, and they point into those ramps — so a
 * screen asks for `bg-accent` or `text-attributed` and never for a raw hue.
 * That indirection is what let this palette replace the previous one without
 * touching the eight app screens.
 */

// The published Chromia ramps, kept verbatim so they can be checked against
// the source at a glance.
const chromia = {
  black: { 500: '#1f1a23', 800: '#17111b' },
  white: { 500: '#fff8f8', 800: '#f5eeee' },
  purple: { 500: '#cc91f0', 800: '#9e5ecf' },
  pink: { 500: '#ffb0c2', 800: '#ff87a6' },
  green: { 500: '#93f091', 800: '#4fcd4c' },
  yellow: { 500: '#ffb500', 800: '#ff9100' },
  orange: { 500: '#ff702b', 800: '#eb4521' },
  red: { 500: '#ff405e', 800: '#d41a45' },
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // The raw ramps, for the places that genuinely want a named hue —
        // sticker chips, the accent cards, the multicolour rows.
        chromia,

        // Accent — purple is the identity's lead colour.
        accent: {
          DEFAULT: chromia.purple[500],
          bright: '#ddb3f5',
          soft: '#e9d2fa',
          tint: '#f6ecfd', // palest wash behind pills and active rows
          deep: chromia.purple[800],
          fg: chromia.white[500],
        },
        // The page itself.
        canvas: {
          DEFAULT: chromia.white[500],
          paper: chromia.white[800],
        },
        // Dark surfaces: panels, the navigation rail, solid buttons.
        noir: {
          DEFAULT: chromia.black[500],
          deep: chromia.black[800],
          soft: '#2a2430',
        },
        ink: {
          DEFAULT: chromia.black[500], // headings and body
          muted: '#6e6472', // secondary text
          faint: '#a99fad', // tertiary text
        },
        // Three light layers that stay distinct: the page behind the app card
        // (shell), the white card itself, and the panels inside it (surface).
        // All cool-leaning, so the purple accent sits on them cleanly instead
        // of fighting a warm pink-cream.
        shell: '#ebe7f0',
        surface: '#f8f7fb',
        line: '#e4e0ea', // hairline borders on white
        muted: '#f3f1f6', // quiet fill

        info: { DEFAULT: chromia.purple[500], ink: chromia.purple[800] },

        // Verdict colours stay semantic and keep their four cuts: DEFAULT for
        // text on white, `deep` for text on a tint, `bright` for a dark
        // surface, `tint` for the fill behind them.
        attributed: {
          DEFAULT: chromia.green[800],
          deep: '#2e8a2c',
          bright: chromia.green[500],
          tint: '#e4fbe3',
        },
        // A deeper violet from the brand purple — not yellow, which clashed
        // with the palette — for the in-between states: probable, online,
        // pending, warnings.
        probable: {
          DEFAULT: '#8a4cc4',
          deep: '#6a3499',
          bright: '#b98ae8',
          tint: '#f1e6fb',
        },
        inconclusive: {
          DEFAULT: '#6e6472',
          deep: '#463f4b',
          bright: '#c3b9c7',
          tint: '#f2ecf933',
        },
        pending: {
          DEFAULT: chromia.purple[800],
          deep: '#6f3ba0',
          bright: chromia.purple[500],
          tint: '#f6ecfd',
        },
        // Destructive actions and hard failures only — never a verdict.
        danger: {
          DEFAULT: chromia.red[800],
          deep: '#a81236',
          bright: chromia.red[500],
          tint: '#ffe3e9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Chromia sets its headlines in a heavy, soft-serifed display face.
        display: ['Fraunces Variable', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        wordmark: ['Comfortaa', 'ui-rounded', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(31, 26, 35, 0.04), 0 10px 30px -18px rgba(31, 26, 35, 0.22)',
        panel: '0 20px 60px -30px rgba(31, 26, 35, 0.45)',
        app: '0 30px 90px -45px rgba(31, 26, 35, 0.35)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        // Chromia rounds hard: panels and cards sit well above the usual scale.
        panel: '1.75rem',
        'panel-lg': '2.5rem',
      },
      letterSpacing: {
        tight: '-0.025em',
      },
    },
  },
  plugins: [],
};

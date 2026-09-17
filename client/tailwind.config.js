/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Verdict colours are fixed by docs/CONTRACTS.md and §7.2.
        // NEVER red — we are not accusing anyone.
        attributed: '#10b981', // emerald
        probable: '#f59e0b', // amber
        inconclusive: '#64748b', // slate
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Verdict colours. Deliberately never red: the system reports a
        // likelihood, it does not accuse anyone.
        attributed: '#10b981', // emerald
        probable: '#f59e0b', // amber
        inconclusive: '#64748b', // slate
      },
    },
  },
  plugins: [],
};

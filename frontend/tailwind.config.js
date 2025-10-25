import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f6f7fb',
        foreground: '#0c0d11',
        neon: {
          teal: '#2ffff3',
          purple: '#b177ff',
          orange: '#ff8a4c',
        },
        muted: '#d4d7e2',
        panel: 'rgba(255, 255, 255, 0.65)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px 0 rgba(47, 255, 243, 0.35)',
        panel: '0 18px 35px -15px rgba(12, 13, 17, 0.65)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [forms],
};

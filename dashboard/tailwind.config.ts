/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ember: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ff6b35',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        coal: {
          50: '#292524',
          100: '#1c1917',
          200: '#171412',
          300: '#12100e',
          400: '#0f0d0b',
          500: '#0a0a0a',
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'ember-float': 'ember-float var(--ember-duration, 4s) ease-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'ember-float': {
          '0%': { transform: 'translate(0, 0) scale(1)', opacity: '0' },
          '10%': { opacity: '0.7' },
          '30%': { transform: 'translate(var(--drift-1, 6px), -30%) scale(0.9)', opacity: '0.8' },
          '60%': { transform: 'translate(var(--drift-2, -4px), -60%) scale(0.6)', opacity: '0.5' },
          '100%': { transform: 'translate(var(--drift-3, 8px), -120%) scale(0.2)', opacity: '0' },
        },
      },
      boxShadow: {
        'ember-glow': '0 0 15px rgba(255, 107, 53, 0.3), 0 0 30px rgba(255, 107, 53, 0.1)',
        'ember-glow-strong': '0 0 20px rgba(255, 107, 53, 0.5), 0 0 40px rgba(255, 107, 53, 0.2)',
      },
    },
  },
  plugins: [],
};

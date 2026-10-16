/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#090a0f',
          850: '#0f1118',
          800: '#151922',
          700: '#1e2433',
          600: '#2c3449'
        },
        brand: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          neon: '#ec4899'
        }
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.6)', opacity: '1' },
          '100%': { transform: 'translateY(-220px) scale(1.3)', opacity: '0' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'float-up': 'floatUp 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}


/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Wehost brand palette
        wh: {
          950: '#091e2b', // deepest bg
          900: '#0b2434', // main app bg
          850: '#0d2c3d', // sidebar bg
          800: '#0f3041', // card bg
          750: '#123649', // inner card / input bg
          700: '#164252', // borders
          650: '#1b5064', // hover borders
          600: '#1f5c72', // hover bg
          teal: '#2dc4b5', // primary accent (logo color)
          light: '#3dd4c7', // teal hover
          dark: '#1ea898', // teal pressed
          100: '#e0f2f0', // bright text
          200: '#b0d9d5', // medium text
          300: '#7db8b3', // muted text
          400: '#4d8a86', // dim text / hints
          500: '#2d6460' // very dim
        }
      }
    }
  },
  plugins: []
}

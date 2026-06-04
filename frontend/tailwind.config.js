/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        amazon: {
          blue: '#131921',
          lightBlue: '#232f3e',
          yellow: '#febd69',
          orange: '#f08804',
          gray: '#eaeded',
        }
      }
    },
  },
  plugins: [],
}

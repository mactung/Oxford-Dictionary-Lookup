/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'oxford-blue': '#002147',
                'oxford-light': '#0047AB',
            }
        },
    },
    plugins: [],
}

/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';
export default {
    content: [
        './src/**/*.{html,js,svelte,ts}',
    ],
    theme: {
      extend: {
        backgroundImage: {
          'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
          'gradient-conic':
            'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        },
      },
    },
    plugins: [
      typography,
    ],
}
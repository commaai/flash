// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [preact(), tailwind()],
  experimental: {
    fonts: [{
      provider: fontProviders.fontsource(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap"
    },
    {
      provider: fontProviders.fontsource(),
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap"
    }]
  },
});
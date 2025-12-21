import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    expect: { requireAssertions: false },
    projects: [
      {
        extends: "./vite.config.js",
        test: {
          name: "client",
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium", headless: true }],
            
          },
          include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          exclude: ["src/lib/server/**"],
        },
      },
      {
        extends: "./vite.config.js",
        test: {
          globals: true,
          name: "server",
          environment: "jsdom",
          include: ["src/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
        },
      },
    ],
  },
  resolve: {
    extensions: ['.svelte', '.js', '.ts', '.json', '.mjs',] // You can add or remove extensions
  },
  ssr: {
    noExternal: [
      "@commaai/qdl",
      "crc-32",
    ],
  },
});

import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { expect, test } from "vitest";
import preactRenderer from "@astrojs/preact/server.js";
import HomePage from "../pages/index.astro";

test("renders without crashing", async () => {
  const container = await AstroContainer.create();
  container.addServerRenderer({
    name: "@astrojs/preact",
    renderer: preactRenderer,
  });
  container.addClientRenderer({
    name: "@astrojs/preact",
    entrypoint: "@astrojs/preact/client.js",
  });
  const result = await container.renderToString(HomePage);

  expect(result).toContain("flash.comma.ai");
});

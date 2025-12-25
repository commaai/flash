import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("/+page.svelte", () => {
  it("should have 'flash.coma.ai' in the page", async () => {
    render(Page);

    const headers = page.getByRole("heading", { level: 1 });
    const header1 = headers.first();
    await expect.element(header1).toBeInTheDocument();
    await expect.element(header1).toHaveTextContent("flash.comma.ai");
  });
});

import { describe, expect, test } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Suspense } from "solid-js";
import App from ".";

describe("App", () => {
  test("renders without crashing", () => {
    render(() => (
      <div>
        <Suspense fallback="loading">
          <App />
        </Suspense>
      </div>
    ));
    expect(screen.getByText("flash.comma.ai")).toBeInTheDocument();
  });
});

/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect, type Page } from "@playwright/test";

function tick(page: Page) {
  return page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:7357/tests/test-page.html");

  // Force register the mock
  await page.evaluate(() => {
    (window as any).register({ forced: true });
  });
});

test.describe("View Transitions Level 2 Features", () => {
  test("It should handle transition types correctly (no types)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const options: StartViewTransitionOptions = {
        update: () => {},
      };

      const transition = document.startViewTransition(options);

      return {
        size: transition.types.size,
      };
    });

    expect(result.size).toBe(0);
  });

  test("It should handle transition types correctly (2 types set)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const options: StartViewTransitionOptions = {
        update: () => {},
        types: ["slide-in", "fade-out"],
      };

      const transition = document.startViewTransition(options);

      return {
        hasSlideIn: transition.types.has("slide-in"),
        hasFadeOut: transition.types.has("fade-out"),
        size: transition.types.size,
      };
    });

    expect(result.hasSlideIn).toBe(true);
    expect(result.hasFadeOut).toBe(true);
    expect(result.size).toBe(2);
  });

  test("The transitionRoot for document.startViewTransion is the document element", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const transition = document.startViewTransition();
      return transition.transitionRoot === document.documentElement;
    });
    expect(result).toBe(true);
  });
});

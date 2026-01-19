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
    (window as any).register(true);
  });
});

test.describe("View Transitions Mock Basics", () => {
  test("It should create a ViewTransition when calling document.startViewTransition", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const updateCallback = () => {};
      const t = document.startViewTransition(updateCallback);
      return t instanceof ViewTransition;
    });

    expect(result).toBe(true);
  });

  test("It should execute the DOM update callback", async ({ page }) => {
    let callbackCalled = false;
    await page.exposeFunction("onCallback", () => {
      callbackCalled = true;
    });

    await page.evaluate(async () => {
      const updateCallback = () => (window as any).onCallback();
      document.startViewTransition(updateCallback);
    });

    // We need to wait for the next tick in the browser
    await tick(page);

    expect(callbackCalled).toBe(true);
  });

  test("It should set/unset document.activeViewTransition", async ({
    page,
  }) => {
    // No VT started yet
    // ~> document.activeViewTransition should NOT be set
    const initialState = await page.evaluate(
      () => document.activeViewTransition,
    );
    expect(initialState).toBeNull();

    // Start a VT
    // ~> document.activeViewTransition should be set
    const viewTransitionStarted = await page.evaluate(async () => {
      const updateCallback = () => {};
      const t = document.startViewTransition(updateCallback);
      return t === document.activeViewTransition;
    });
    expect(viewTransitionStarted).toBe(true);

    // VT has finished
    // ~> document.activeViewTransition should NOT be set
    const viewTransitionFinished = await page.evaluate(async () => {
      if (document.activeViewTransition) {
        await (document.activeViewTransition as ViewTransition).finished;
      }
      return document.activeViewTransition;
    });
    expect(viewTransitionFinished).toBeNull();

    // Start and await the VT to be finished
    // ~> document.activeViewTransition should NOT be set
    const startAndAwaitFinished = await page.evaluate(async () => {
      const updateCallback = () => {};
      const t = document.startViewTransition(updateCallback);
      await t.finished;
      return document.activeViewTransition;
    });
    expect(startAndAwaitFinished).toBeNull();
  });

  test("It should handle transition types correctly (Level 2 Spec)", async ({
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

  test("It should skip the transition when skipTransition() is called", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const transition = document.startViewTransition(() => {});
      transition.skipTransition();

      let readyRejected = false;
      try {
        await transition.ready;
      } catch (e) {
        readyRejected = e instanceof DOMException;
      }

      await transition.finished;

      return { readyRejected };
    });

    expect(result.readyRejected).toBe(true);
  });
});

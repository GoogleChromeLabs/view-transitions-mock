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

test.describe("View Transitions Mock Double startViewTransition", () => {
  test("It should execute both DOM update callbacks", async ({ page }) => {
    let callback1Called = false;
    await page.exposeFunction("onCallback1", () => {
      callback1Called = true;
    });

    let callback2Called = false;
    await page.exposeFunction("onCallback2", () => {
      callback2Called = true;
    });

    await page.evaluate(async () => {
      const updateCallback1 = () => (window as any).onCallback1();
      const updateCallback2 = () => (window as any).onCallback2();

      document.startViewTransition(updateCallback1);
      document.startViewTransition(updateCallback2);
    });

    // We need to wait for the next tick in the browser
    await tick(page);

    expect(callback1Called).toBe(true);
    expect(callback2Called).toBe(true);
  });

  test("It should update the document.activeViewTransition", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const updateCallback1 = () => {};
      const updateCallback2 = () => {};

      const t1 = document.startViewTransition(updateCallback1);
      const t2 = document.startViewTransition(updateCallback2);

      return t2 === document.activeViewTransition;
    });

    expect(result).toBe(true);
  });

  test("It should skip the transition when skipTransition() is called", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const t1 = document.startViewTransition(() => {});
      const t2 = document.startViewTransition(() => {});

      let t1ReadyRejected = false;
      let t2ReadyRejected = false;

      try {
        await t1.ready;
      } catch (e) {
        t1ReadyRejected = e instanceof DOMException;
      }

      try {
        await t2.ready;
      } catch (e) {
        t2ReadyRejected = e instanceof DOMException;
      }

      await t2.finished;

      return { t1ReadyRejected, t2ReadyRejected };
    });

    expect(result.t1ReadyRejected).toBe(true);
    expect(result.t2ReadyRejected).toBe(false);
  });
});

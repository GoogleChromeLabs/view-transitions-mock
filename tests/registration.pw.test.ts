/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:7357/tests/test-page.html");
});

test.describe("Registration and Unregistration", () => {
  test("should log a message to the console when registering", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));

    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    expect(messages.length).toBe(1);
    expect(messages[0]).toBe(
      "Support for Same-Document View Transitions is now mocked",
    );
  });

  test("should not double register", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));

    await page.evaluate(() => {
      (window as any).register({ forced: true });
      (window as any).register({ forced: true });
    });

    expect(messages.length).toBe(1);
    expect(messages[0]).toBe(
      "Support for Same-Document View Transitions is now mocked",
    );
  });

  test("should log a message to the console when unregistering", async ({
    page,
  }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));

    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    await page.evaluate(() => {
      (window as any).unregister();
    });

    expect(messages.length).toBe(2);
    expect(messages[1]).toBe(
      "Support for Same-Document View Transitions is no longer mocked",
    );
  });

  test("should not double unregister", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));

    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    await page.evaluate(() => {
      (window as any).unregister();
      (window as any).unregister();
    });

    expect(messages.length).toBe(2);
    expect(messages[1]).toBe(
      "Support for Same-Document View Transitions is no longer mocked",
    );
  });

  test("should not register when there is native support for types", async ({
    page,
  }, testInfo) => {
    const messages: string[] = [];

    page.on("console", (msg) => messages.push(msg.text()));

    await page.evaluate(() => {
      (window as any).register({ requireTypes: true });
    });

    if (
      testInfo.project.name.endsWith("-nosupport") ||
      testInfo.project.name === "firefox-latest"
    ) {
      expect(messages.length).toBe(1);

      expect(messages[0]).toBe(
        "Support for Same-Document View Transitions is now mocked",
      );
    } else {
      expect(messages.length).toBe(0);
    }
  });
});

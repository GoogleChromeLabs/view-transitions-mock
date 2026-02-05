/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:7357/tests/test-page.html");
  await page.evaluate(() => {
    (window as any).startAndWatchViewTransition = (
      order: string[],
      callback: null | ViewTransitionUpdateCallback = () => {},
    ): ViewTransition => {
      let transition;
      if (callback) {
        transition = document.startViewTransition(callback);
      } else {
        transition = document.startViewTransition();
      }

      transition.updateCallbackDone
        .then(() => order.push("updateCallbackDone"))
        .catch(() => order.push("updateCallbackDoneCatch"));
      transition.ready
        .then(() => order.push("ready"))
        .catch(() => order.push("readyCatch"));
      transition.finished
        .then(() => order.push("finished"))
        .catch(() => order.push("finishedCatch"));

      return transition;
    };
  });
});

test.describe("Promises Order", () => {
  test("It should resolve promises in the correct order (normal flow)", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(order);

      await transition.finished;
      return order;
    };

    const expectedResult = ["updateCallbackDone", "ready", "finished"];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(startVTAndReturnLoggedMessages);
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(startVTAndReturnLoggedMessages);
    expect(mockedResult).toEqual(expectedResult);
  });

  test("It should resolve promises in the correct order (normal flow, no callback)", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(
        order,
        null,
      );

      await transition.finished;
      return order;
    };

    const expectedResult = ["updateCallbackDone", "ready", "finished"];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(startVTAndReturnLoggedMessages);
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(startVTAndReturnLoggedMessages);
    expect(mockedResult).toEqual(expectedResult);
  });

  test("It should resolve promises in the correct order (skip immediately)", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(order);
      transition.skipTransition();

      await transition.finished;
      return order;
    };

    const expectedResult = ["readyCatch", "updateCallbackDone", "finished"];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(startVTAndReturnLoggedMessages);
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(startVTAndReturnLoggedMessages);
    expect(mockedResult).toEqual(expectedResult);
  });

  test("It should resolve promises in the correct order (skip after ready)", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(order);

      await transition.ready;
      transition.skipTransition();

      await transition.finished;
      return order;
    };

    const expectedResult = ["updateCallbackDone", "ready", "finished"];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(startVTAndReturnLoggedMessages);
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(startVTAndReturnLoggedMessages);
    expect(mockedResult).toEqual(expectedResult);
  });

  test("It should resolve promises in the correct order (skip after updateCallbackDone)", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(order);

      await transition.updateCallbackDone;
      transition.skipTransition();

      await transition.finished;
      return order;
    };

    const expectedResult = ["updateCallbackDone", "ready", "finished"];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(startVTAndReturnLoggedMessages);
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(startVTAndReturnLoggedMessages);
    expect(mockedResult).toEqual(expectedResult);
  });

  test("It should resolve promises in the correct order (skip after finished)", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(order);

      await transition.finished;
      transition.skipTransition();

      return order;
    };

    const expectedResult = ["updateCallbackDone", "ready", "finished"];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(startVTAndReturnLoggedMessages);
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(startVTAndReturnLoggedMessages);
    expect(mockedResult).toEqual(expectedResult);
  });
});

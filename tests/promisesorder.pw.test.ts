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

  test("It should reject ready before running the callback when skipped immediately", async ({
    page,
  }, testInfo) => {
    const startVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const transition = (window as any).startAndWatchViewTransition(
        order,
        () => {
          order.push("callback");
        },
      );
      transition.skipTransition();

      await transition.finished;
      return order;
    };

    const expectedResult = [
      "readyCatch",
      "callback",
      "updateCallbackDone",
      "finished",
    ];

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

  test("It should order callbacks and promises accurately on double startViewTransition", async ({
    page,
  }, testInfo) => {
    const startDoubleVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const vt1 = document.startViewTransition(() => {
        order.push("callback1");
      });
      vt1.updateCallbackDone
        .then(() => order.push("updateCallbackDone1"))
        .catch(() => order.push("updateCallbackDone1Catch"));
      vt1.ready
        .then(() => order.push("ready1"))
        .catch(() => order.push("ready1Catch"));
      vt1.finished
        .then(() => order.push("finished1"))
        .catch(() => order.push("finished1Catch"));

      const vt2 = document.startViewTransition(() => {
        order.push("callback2");
      });
      vt2.updateCallbackDone
        .then(() => order.push("updateCallbackDone2"))
        .catch(() => order.push("updateCallbackDone2Catch"));
      vt2.ready
        .then(() => order.push("ready2"))
        .catch(() => order.push("ready2Catch"));
      vt2.finished
        .then(() => order.push("finished2"))
        .catch(() => order.push("finished2Catch"));

      await Promise.all([vt1.finished, vt2.finished]);
      return order;
    };

    const expectedResult = [
      "ready1Catch",
      "callback1",
      "updateCallbackDone1",
      "finished1",
      "callback2",
      "updateCallbackDone2",
      "ready2",
      "finished2",
    ];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(
        startDoubleVTAndReturnLoggedMessages,
      );
      expect(nativeResult).toEqual(expectedResult);
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(
      startDoubleVTAndReturnLoggedMessages,
    );
    expect(mockedResult).toEqual(expectedResult);
  });

  test("It should order callbacks and promises accurately on triple startViewTransition", async ({
    page,
  }, testInfo) => {
    const startTripleVTAndReturnLoggedMessages = async () => {
      const order: string[] = [];
      const attach = (vt: ViewTransition, n: number) => {
        vt.updateCallbackDone
          .then(() => order.push(`updateCallbackDone${n}`))
          .catch(() => order.push(`updateCallbackDone${n}Catch`));
        vt.ready
          .then(() => order.push(`ready${n}`))
          .catch(() => order.push(`ready${n}Catch`));
        vt.finished
          .then(() => order.push(`finished${n}`))
          .catch(() => order.push(`finished${n}Catch`));
      };

      const vt1 = document.startViewTransition(() => {
        order.push("callback1");
      });
      attach(vt1, 1);

      const vt2 = document.startViewTransition(() => {
        order.push("callback2");
      });
      attach(vt2, 2);

      const vt3 = document.startViewTransition(() => {
        order.push("callback3");
      });
      attach(vt3, 3);

      await Promise.all([vt1.finished, vt2.finished, vt3.finished]);
      return order;
    };

    // Per-task order (Chromium, WebKit < 323173@main, and this mock):
    // each skipped transition’s update callback runs in its own task / microtask turn,
    // so vt1’s updateCallbackDone & finished settle before vt2’s callback runs.
    const expectedResult = [
      "ready1Catch",
      "ready2Catch",
      "callback1",
      "updateCallbackDone1",
      "finished1",
      "callback2",
      "updateCallbackDone2",
      "finished2",
      "callback3",
      "updateCallbackDone3",
      "ready3",
      "finished3",
    ];

    // Spec batch-flush order (Firefox, and WebKit >= 323173@main):
    // #flush-the-update-callback-queue iterates [vt1, vt2] in a single task.
    // In #call-the-update-callback, WebIDL runs a microtask checkpoint when
    // callback1 returns (step 5) — before step 8 queues the reaction to
    // callbackPromise. So callback2 runs before vt1’s reaction drains during
    // callback2’s exit microtask checkpoint.
    const expectedBatchFlushResult = [
      "ready1Catch",
      "ready2Catch",
      "callback1",
      "callback2",
      "updateCallbackDone1",
      "finished1",
      "updateCallbackDone2",
      "finished2",
      "callback3",
      "updateCallbackDone3",
      "ready3",
      "finished3",
    ];

    // Native result
    if (!testInfo.project.name.endsWith("-nosupport")) {
      const nativeResult = await page.evaluate(
        startTripleVTAndReturnLoggedMessages,
      );
      expect([expectedResult, expectedBatchFlushResult]).toContainEqual(
        nativeResult,
      );
    }

    // Force register the mock
    await page.evaluate(() => {
      (window as any).register({ forced: true });
    });

    // Mocked result
    const mockedResult = await page.evaluate(
      startTripleVTAndReturnLoggedMessages,
    );
    expect(mockedResult).toEqual(expectedResult);
  });
});

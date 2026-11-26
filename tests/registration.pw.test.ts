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

  test("should not register when there is native support for types and requireScoped is false", async ({
    page,
  }) => {
    const messages: string[] = [];

    page.on("console", (msg) => messages.push(msg.text()));

    const hasNativeTypes = await page.evaluate(
      () =>
        "startViewTransition" in document &&
        "ViewTransition" in window &&
        "types" in ViewTransition.prototype,
    );

    await page.evaluate(() => {
      (window as any).register({ requireTypes: true, requireScoped: false });
    });

    if (!hasNativeTypes) {
      expect(messages.length).toBe(1);

      expect(messages[0]).toBe(
        "Support for Same-Document View Transitions is now mocked",
      );
    } else {
      expect(messages.length).toBe(0);
    }
  });

  test("should granularly mock only Element-Scoped View Transitions when Document VT + Types are natively supported", async ({
    page,
  }, testInfo) => {
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));

    const nativeState = await page.evaluate(() => ({
      hasNativeDoc: "startViewTransition" in document,
      hasNativeTypes:
        "ViewTransition" in window && "types" in ViewTransition.prototype,
      hasNativeScoped: "startViewTransition" in Element.prototype,
    }));

    const afterRegister = await page.evaluate(() => {
      (window as any).register();
      const div = document.createElement("div");
      document.body.appendChild(div);
      const t = div.startViewTransition({
        update: () => {},
        types: ["scoped-type"],
      });
      const result = {
        hasOwnDocStartVT: Object.prototype.hasOwnProperty.call(
          document,
          "startViewTransition",
        ),
        hasElStartVT: "startViewTransition" in Element.prototype,
        hasElActiveVT: "activeViewTransition" in Element.prototype,
        isViewTransitionInstance: t instanceof ViewTransition,
        isTypeSetInstance:
          t.types instanceof (window as any).ViewTransitionTypeSet,
        hasType: t.types.has("scoped-type"),
        transitionRootMatches: t.transitionRoot === div,
      };
      t.skipTransition();
      return result;
    });

    expect(afterRegister.hasElStartVT).toBe(true);
    expect(afterRegister.hasElActiveVT).toBe(true);
    expect(afterRegister.isViewTransitionInstance).toBe(true);
    expect(afterRegister.isTypeSetInstance).toBe(true);
    expect(afterRegister.hasType).toBe(true);
    expect(afterRegister.transitionRootMatches).toBe(true);

    if (
      nativeState.hasNativeDoc &&
      nativeState.hasNativeTypes &&
      !nativeState.hasNativeScoped
    ) {
      // Granular mode: native document.startViewTransition was NOT overwritten
      expect(afterRegister.hasOwnDocStartVT).toBe(false);
      expect(messages).toEqual([
        "Support for Element-Scoped View Transitions is now mocked",
      ]);

      await page.evaluate(() => {
        (window as any).unregister();
      });

      expect(messages).toEqual([
        "Support for Element-Scoped View Transitions is now mocked",
        "Support for Element-Scoped View Transitions is no longer mocked",
      ]);

      const afterUnregister = await page.evaluate(() => ({
        hasElStartVT: "startViewTransition" in Element.prototype,
        hasElActiveVT: "activeViewTransition" in Element.prototype,
      }));
      expect(afterUnregister.hasElStartVT).toBe(false);
      expect(afterUnregister.hasElActiveVT).toBe(false);
    } else if (
      nativeState.hasNativeDoc &&
      nativeState.hasNativeTypes &&
      nativeState.hasNativeScoped
    ) {
      // Full native support: nothing mocked
      expect(afterRegister.hasOwnDocStartVT).toBe(false);
      expect(messages).toEqual([]);
    } else {
      // No native support or missing types: full mock registered
      expect(afterRegister.hasOwnDocStartVT).toBe(true);
      expect(messages).toEqual([
        "Support for Same-Document View Transitions is now mocked",
      ]);
    }
  });

  test("should not mock Element.prototype.startViewTransition when requireScoped is false", async ({
    page,
  }) => {
    const hasNativeScoped = await page.evaluate(
      () => "startViewTransition" in Element.prototype,
    );

    await page.evaluate(() => {
      (window as any).register({ requireScoped: false });
    });

    const hasScopedAfterRegister = await page.evaluate(
      () => "startViewTransition" in Element.prototype,
    );

    expect(hasScopedAfterRegister).toBe(hasNativeScoped);
  });

  test("should allow clean unregister and re-register cycles", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const hadNativeElSVT = "startViewTransition" in Element.prototype;

      (window as any).register({ forced: true });
      const hasAfterFirstReg = "startViewTransition" in Element.prototype;

      (window as any).unregister();
      const hasAfterFirstUnreg = "startViewTransition" in Element.prototype;

      (window as any).register({ forced: true });
      const div = document.createElement("div");
      document.body.appendChild(div);
      const t = div.startViewTransition(() => {});
      const rootMatches = t.transitionRoot === div;
      await t.finished;

      (window as any).unregister();
      const hasAfterSecondUnreg = "startViewTransition" in Element.prototype;

      return {
        hadNativeElSVT,
        hasAfterFirstReg,
        hasAfterFirstUnreg,
        rootMatches,
        hasAfterSecondUnreg,
      };
    });

    expect(result.hasAfterFirstReg).toBe(true);
    expect(result.hasAfterFirstUnreg).toBe(result.hadNativeElSVT);
    expect(result.rootMatches).toBe(true);
    expect(result.hasAfterSecondUnreg).toBe(result.hadNativeElSVT);
  });
});

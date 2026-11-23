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

test.describe("Element-Scoped View Transitions Basics", () => {
  test("It should create a ViewTransition with transitionRoot set to the element", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const t = div.startViewTransition(() => {});
      const isInstance = t instanceof ViewTransition;
      const rootMatches = t.transitionRoot === div;
      await t.finished;

      return { isInstance, rootMatches };
    });

    expect(result.isInstance).toBe(true);
    expect(result.rootMatches).toBe(true);
  });

  test("It should execute the DOM update callback", async ({ page }) => {
    let callbackCalled = false;
    await page.exposeFunction("onScopedCallback", () => {
      callbackCalled = true;
    });

    await page.evaluate(() => {
      const div = document.createElement("div");
      document.body.appendChild(div);
      div.startViewTransition(() => (window as any).onScopedCallback());
    });

    await tick(page);

    expect(callbackCalled).toBe(true);
  });

  test("It should handle options with types as a cloned ViewTransitionTypeSet", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const inputTypes = ["slide", "fast"];
      const t = div.startViewTransition({
        update: () => {},
        types: inputTypes,
      });

      // Mutating original input array must not affect transition.types
      inputTypes.push("mutated");

      const typesRef1 = t.types;
      const typesRef2 = t.types;
      const isSameObject = typesRef1 === typesRef2;
      const isTypeSetInstance =
        t.types instanceof (window as any).ViewTransitionTypeSet;
      const values = [...t.types];

      await t.finished;

      return { isSameObject, isTypeSetInstance, values };
    });

    expect(result.isSameObject).toBe(true);
    expect(result.isTypeSetInstance).toBe(true);
    expect(result.values).toEqual(["slide", "fast"]);
  });

  test("It should set/unset element.activeViewTransition without touching document.activeViewTransition", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const initialElAVT = div.activeViewTransition;
      const initialDocAVT = document.activeViewTransition;

      const t = div.startViewTransition(() => {});
      const duringElAVTMatches = div.activeViewTransition === t;
      const duringDocAVT = document.activeViewTransition;

      await t.finished;

      const afterElAVT = div.activeViewTransition;
      const afterDocAVT = document.activeViewTransition;

      // Test skipTransition clears element.activeViewTransition synchronously
      const t2 = div.startViewTransition(() => {});
      const duringElAVT2Matches = div.activeViewTransition === t2;
      t2.skipTransition();
      const immediatelyAfterSkipElAVT = div.activeViewTransition;
      await t2.ready.catch(() => {});
      await t2.finished;

      return {
        initialElAVT,
        initialDocAVT,
        duringElAVTMatches,
        duringDocAVT,
        afterElAVT,
        afterDocAVT,
        duringElAVT2Matches,
        immediatelyAfterSkipElAVT,
      };
    });

    expect(result.initialElAVT).toBeNull();
    expect(result.initialDocAVT).toBeNull();
    expect(result.duringElAVTMatches).toBe(true);
    expect(result.duringDocAVT).toBeNull();
    expect(result.afterElAVT).toBeNull();
    expect(result.afterDocAVT).toBeNull();
    expect(result.duringElAVT2Matches).toBe(true);
    expect(result.immediatelyAfterSkipElAVT).toBeNull();
  });

  test("It should resolve promises in spec order for normal, skipped, async-skipped, and throwing callbacks", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const watch = (vt: ViewTransition) => {
        const order: string[] = [];
        vt.updateCallbackDone
          .then(() => order.push("updateCallbackDone"))
          .catch((e) => order.push(`updateCallbackDoneCatch:${e.name}`));
        vt.ready
          .then(() => order.push("ready"))
          .catch((e) => order.push(`readyCatch:${e.name}`));
        vt.finished
          .then(() => order.push("finished"))
          .catch((e) => order.push(`finishedCatch:${e.name}`));
        return order;
      };

      // 1. Normal flow
      const vt1 = div.startViewTransition(() => {});
      const order1 = watch(vt1);
      await vt1.finished;

      // 2. Skip immediately with async callback (finished must wait for callback)
      const seq2: string[] = [];
      const vt2 = div.startViewTransition(async () => {
        seq2.push("cb-start");
        await new Promise((r) => setTimeout(r, 20));
        seq2.push("cb-end");
      });
      vt2.ready.catch((e) => seq2.push(`readyCatch:${e.name}`));
      vt2.updateCallbackDone.then(() => seq2.push("updateCallbackDone"));
      vt2.finished.then(() => seq2.push("finished"));
      vt2.skipTransition();
      await vt2.finished;

      // 3. Callback throws error
      const vt3 = div.startViewTransition(() => {
        throw new TypeError("boom");
      });
      const order3 = watch(vt3);
      await vt3.finished.catch(() => {});

      // 4. Async callback rejects
      const vt4 = div.startViewTransition(async () => {
        throw new RangeError("async-boom");
      });
      const order4 = watch(vt4);
      await vt4.finished.catch(() => {});

      return { order1, seq2, order3, order4 };
    });

    expect(result.order1).toEqual(["updateCallbackDone", "ready", "finished"]);
    expect(result.seq2).toEqual([
      "readyCatch:AbortError",
      "cb-start",
      "cb-end",
      "updateCallbackDone",
      "finished",
    ]);
    expect(result.order3).toEqual([
      "updateCallbackDoneCatch:TypeError",
      "readyCatch:TypeError",
      "finishedCatch:TypeError",
    ]);
    expect(result.order4).toEqual([
      "updateCallbackDoneCatch:RangeError",
      "readyCatch:RangeError",
      "finishedCatch:RangeError",
    ]);
  });
});

test.describe("Document vs document.documentElement", () => {
  test("document.startViewTransition and document.documentElement.startViewTransition share activeViewTransition and skip each other", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      // 1. document.startViewTransition sets both document and documentElement activeViewTransition
      const tDoc = document.startViewTransition(() => {});
      const docSetsBoth =
        document.activeViewTransition === tDoc &&
        document.documentElement.activeViewTransition === tDoc;
      await tDoc.finished;
      const clearedAfterDoc =
        document.activeViewTransition === null &&
        document.documentElement.activeViewTransition === null;

      // 2. document.documentElement.startViewTransition sets both
      const tDocEl = document.documentElement.startViewTransition(() => {});
      const docElSetsBoth =
        document.activeViewTransition === tDocEl &&
        document.documentElement.activeViewTransition === tDocEl &&
        tDocEl.transitionRoot === document.documentElement;
      await tDocEl.finished;

      // 3. Starting on documentElement skips active document transition
      const order1: string[] = [];
      const vt1 = document.startViewTransition(() => {
        order1.push("doc");
      });
      const vt2 = document.documentElement.startViewTransition(() => {
        order1.push("docEl");
      });
      let vt1Err: string | null = null;
      try {
        await vt1.ready;
      } catch (e: any) {
        vt1Err = e.name;
      }
      await vt2.finished;

      // 4. Starting on document skips active documentElement transition
      const order2: string[] = [];
      const vt3 = document.documentElement.startViewTransition(() => {
        order2.push("docEl");
      });
      const vt4 = document.startViewTransition(() => {
        order2.push("doc");
      });
      let vt3Err: string | null = null;
      try {
        await vt3.ready;
      } catch (e: any) {
        vt3Err = e.name;
      }
      await vt4.finished;

      return {
        docSetsBoth,
        clearedAfterDoc,
        docElSetsBoth,
        vt1Err,
        order1,
        vt3Err,
        order2,
      };
    });

    expect(result.docSetsBoth).toBe(true);
    expect(result.clearedAfterDoc).toBe(true);
    expect(result.docElSetsBoth).toBe(true);
    expect(result.vt1Err).toBe("AbortError");
    expect(result.order1).toEqual(["doc", "docEl"]);
    expect(result.vt3Err).toBe("AbortError");
    expect(result.order2).toEqual(["docEl", "doc"]);
  });
});

test.describe("Double startViewTransition on same element", () => {
  test("It should skip the first transition on the same element and execute both callbacks in order", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const cbOrder: string[] = [];
      const t1 = div.startViewTransition(() => {
        cbOrder.push("first");
      });
      const t2 = div.startViewTransition(() => {
        cbOrder.push("second");
      });

      const activeIsSecond = div.activeViewTransition === t2;

      let t1Err: string | null = null;
      let t2Err: string | null = null;
      try {
        await t1.ready;
      } catch (e: any) {
        t1Err = e.name;
      }
      try {
        await t2.ready;
      } catch (e: any) {
        t2Err = e.name;
      }

      await Promise.all([t1.finished, t2.finished]);

      return {
        activeIsSecond,
        t1Err,
        t2Err,
        cbOrder,
        finalActive: div.activeViewTransition,
      };
    });

    expect(result.activeIsSecond).toBe(true);
    expect(result.t1Err).toBe("AbortError");
    expect(result.t2Err).toBeNull();
    expect(result.cbOrder).toEqual(["first", "second"]);
    expect(result.finalActive).toBeNull();
  });
});

test.describe("Concurrent Element-Scoped View Transitions", () => {
  test("It should run transitions on separate elements concurrently without skipping each other", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const el1 = document.createElement("div");
      const el2 = document.createElement("div");
      const el3 = document.createElement("div");
      document.body.appendChild(el1);
      document.body.appendChild(el2);
      document.body.appendChild(el3);

      // Start in reverse DOM order to verify callbacks run in creation order
      const cbOrder: string[] = [];
      const t3 = el3.startViewTransition(() => {
        cbOrder.push("el3");
      });
      const t1 = el1.startViewTransition(() => {
        cbOrder.push("el1");
      });
      const t2 = el2.startViewTransition(() => {
        cbOrder.push("el2");
      });

      const activeMatches =
        el1.activeViewTransition === t1 &&
        el2.activeViewTransition === t2 &&
        el3.activeViewTransition === t3 &&
        document.activeViewTransition === null;

      await Promise.all([t1.ready, t2.ready, t3.ready]);
      await Promise.all([t1.finished, t2.finished, t3.finished]);

      const allCleared =
        el1.activeViewTransition === null &&
        el2.activeViewTransition === null &&
        el3.activeViewTransition === null;

      return { activeMatches, cbOrder, allCleared };
    });

    expect(result.activeMatches).toBe(true);
    expect(result.cbOrder).toEqual(["el3", "el1", "el2"]);
    expect(result.allCleared).toBe(true);
  });

  test("An async updateCallback on one element must not block a concurrent transition on another element", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const slowEl = document.createElement("div");
      const fastEl = document.createElement("div");
      document.body.appendChild(slowEl);
      document.body.appendChild(fastEl);

      let resolveSlow!: () => void;
      const slowPromise = new Promise<void>((r) => {
        resolveSlow = r;
      });

      const events: string[] = [];

      const tSlow = slowEl.startViewTransition(async () => {
        events.push("slow-cb-start");
        await slowPromise;
        events.push("slow-cb-end");
      });
      tSlow.finished.then(() => events.push("slow-finished"));

      const tFast = fastEl.startViewTransition(() => {
        events.push("fast-cb");
      });
      tFast.finished.then(() => events.push("fast-finished"));

      // Fast transition must finish while slow transition is still active!
      await tFast.finished;
      const slowStillActiveWhenFastDone =
        slowEl.activeViewTransition === tSlow &&
        fastEl.activeViewTransition === null;

      resolveSlow();
      await tSlow.finished;

      return {
        slowStillActiveWhenFastDone,
        events,
        finalSlowAVT: slowEl.activeViewTransition,
      };
    });

    expect(result.slowStillActiveWhenFastDone).toBe(true);
    expect(result.events).toEqual([
      "slow-cb-start",
      "fast-cb",
      "fast-finished",
      "slow-cb-end",
      "slow-finished",
    ]);
    expect(result.finalSlowAVT).toBeNull();
  });

  test("Skipping or restarting a transition on one element must not affect a concurrent transition on another element", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const el1 = document.createElement("div");
      const el2 = document.createElement("div");
      document.body.appendChild(el1);
      document.body.appendChild(el2);

      let resolveEl2!: () => void;
      const el2Gate = new Promise<void>((r) => {
        resolveEl2 = r;
      });

      const t2 = el2.startViewTransition(async () => {
        await el2Gate;
      });
      let t2ReadyRejected = false;
      t2.ready.catch(() => {
        t2ReadyRejected = true;
      });

      // Start and immediately skip on el1
      const t1a = el1.startViewTransition(() => {});
      t1a.skipTransition();
      await t1a.ready.catch(() => {});

      // Double-start on el1
      const t1b = el1.startViewTransition(() => {});
      const t1c = el1.startViewTransition(() => {});
      await t1b.ready.catch(() => {});
      await t1c.finished;

      const el2StillActive = el2.activeViewTransition === t2;

      resolveEl2();
      await t2.ready;
      await t2.finished;

      return { el2StillActive, t2ReadyRejected };
    });

    expect(result.el2StillActive).toBe(true);
    expect(result.t2ReadyRejected).toBe(false);
  });
});

test.describe("Nested / Enclosing View Transitions", () => {
  test("It should allow an enclosing element View Transition to run concurrently with an ongoing inner View Transition", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const outer = document.createElement("div");
      const inner = document.createElement("div");
      outer.appendChild(inner);
      document.body.appendChild(outer);

      // Case 1: inner is animating (ready resolved), then outer starts
      const tInner1 = inner.startViewTransition(() => {});
      await tInner1.ready;

      const tOuter1 = outer.startViewTransition(() => {});
      await tOuter1.ready;

      const bothActiveWhileAnimating =
        inner.activeViewTransition === tInner1 &&
        outer.activeViewTransition === tOuter1 &&
        document.activeViewTransition === null;

      await Promise.all([tInner1.finished, tOuter1.finished]);

      // Case 2: inner is awaiting an async callback, outer runs to completion while inner is still running
      let resolveInner!: () => void;
      const innerGate = new Promise<void>((r) => {
        resolveInner = r;
      });

      const tInner2 = inner.startViewTransition(async () => {
        await innerGate;
      });
      let inner2Rejected = false;
      tInner2.ready.catch(() => {
        inner2Rejected = true;
      });

      const tOuter2 = outer.startViewTransition(() => {});
      await tOuter2.ready;
      const bothActiveDuringAsyncInner =
        inner.activeViewTransition === tInner2 &&
        outer.activeViewTransition === tOuter2;

      await tOuter2.finished;
      const innerStillActiveAfterOuterFinished =
        inner.activeViewTransition === tInner2 &&
        outer.activeViewTransition === null;

      resolveInner();
      await tInner2.ready;
      await tInner2.finished;

      return {
        bothActiveWhileAnimating,
        bothActiveDuringAsyncInner,
        innerStillActiveAfterOuterFinished,
        inner2Rejected,
        finalCleared:
          inner.activeViewTransition === null &&
          outer.activeViewTransition === null,
      };
    });

    expect(result.bothActiveWhileAnimating).toBe(true);
    expect(result.bothActiveDuringAsyncInner).toBe(true);
    expect(result.innerStillActiveAfterOuterFinished).toBe(true);
    expect(result.inner2Rejected).toBe(false);
    expect(result.finalCleared).toBe(true);
  });

  test("It should allow an enclosing document.startViewTransition() to run concurrently with ongoing nested element View Transitions", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const outer = document.createElement("div");
      const middle = document.createElement("div");
      const inner = document.createElement("div");
      middle.appendChild(inner);
      outer.appendChild(middle);
      document.body.appendChild(outer);

      const tInner = inner.startViewTransition(() => {});
      await tInner.ready;

      const tMiddle = middle.startViewTransition(() => {});
      await tMiddle.ready;

      const tOuter = outer.startViewTransition(() => {});
      await tOuter.ready;

      const tDoc = document.startViewTransition(() => {});
      await tDoc.ready;

      const allFourActiveSimultaneously =
        inner.activeViewTransition === tInner &&
        middle.activeViewTransition === tMiddle &&
        outer.activeViewTransition === tOuter &&
        document.activeViewTransition === tDoc &&
        document.documentElement.activeViewTransition === tDoc;

      await Promise.all([
        tInner.finished,
        tMiddle.finished,
        tOuter.finished,
        tDoc.finished,
      ]);

      const allCleared =
        inner.activeViewTransition === null &&
        middle.activeViewTransition === null &&
        outer.activeViewTransition === null &&
        document.activeViewTransition === null &&
        document.documentElement.activeViewTransition === null;

      return { allFourActiveSimultaneously, allCleared };
    });

    expect(result.allFourActiveSimultaneously).toBe(true);
    expect(result.allCleared).toBe(true);
  });

  test("Skipping an inner transition must not skip an enclosing outer transition (and vice versa)", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const outer = document.createElement("div");
      const inner = document.createElement("div");
      outer.appendChild(inner);
      document.body.appendChild(outer);

      // Skip inner while outer is running
      let resolveOuter!: () => void;
      const outerGate = new Promise<void>((r) => {
        resolveOuter = r;
      });
      const tInner = inner.startViewTransition(() => {});
      const tOuter = outer.startViewTransition(async () => {
        await outerGate;
      });
      let outerErr: string | null = null;
      tOuter.ready.catch((e) => {
        outerErr = e.name;
      });

      tInner.skipTransition();
      await tInner.ready.catch(() => {});
      await tInner.finished;

      const outerStillActiveAfterInnerSkip =
        outer.activeViewTransition === tOuter &&
        inner.activeViewTransition === null;

      resolveOuter();
      await tOuter.ready;
      await tOuter.finished;

      // Skip outer while inner is running
      let resolveInner!: () => void;
      const innerGate = new Promise<void>((r) => {
        resolveInner = r;
      });
      const tInner2 = inner.startViewTransition(async () => {
        await innerGate;
      });
      let inner2Err: string | null = null;
      tInner2.ready.catch((e) => {
        inner2Err = e.name;
      });

      const tOuter2 = outer.startViewTransition(() => {});
      tOuter2.skipTransition();
      await tOuter2.ready.catch(() => {});
      await tOuter2.finished;

      const innerStillActiveAfterOuterSkip =
        inner.activeViewTransition === tInner2 &&
        outer.activeViewTransition === null;

      resolveInner();
      await tInner2.ready;
      await tInner2.finished;

      return {
        outerErr,
        outerStillActiveAfterInnerSkip,
        inner2Err,
        innerStillActiveAfterOuterSkip,
      };
    });

    expect(result.outerErr).toBeNull();
    expect(result.outerStillActiveAfterInnerSkip).toBe(true);
    expect(result.inner2Err).toBeNull();
    expect(result.innerStillActiveAfterOuterSkip).toBe(true);
  });
});

test.describe("Layout Containment Eligibility (InvalidStateError)", () => {
  test("It should immediately skip with InvalidStateError on disconnected elements while still running updateCallback", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      // 1. Disconnected element with normal callback
      const disconnected = document.createElement("div");
      let cbRan = false;
      const vt1 = disconnected.startViewTransition(() => {
        cbRan = true;
      });
      const avtImmediate = disconnected.activeViewTransition;
      let readyErr1: string | null = null;
      try {
        await vt1.ready;
      } catch (e: any) {
        readyErr1 = e.name;
      }
      await vt1.updateCallbackDone;
      await vt1.finished;

      // 2. Disconnected element with throwing callback
      const disconnected2 = document.createElement("div");
      const vt2 = disconnected2.startViewTransition(() => {
        throw new Error("cb-fail");
      });
      let readyErr2: string | null = null;
      let ucdErr2: string | null = null;
      let finishedErr2: string | null = null;
      try {
        await vt2.ready;
      } catch (e: any) {
        readyErr2 = e.name;
      }
      try {
        await vt2.updateCallbackDone;
      } catch (e: any) {
        ucdErr2 = e.message;
      }
      try {
        await vt2.finished;
      } catch (e: any) {
        finishedErr2 = e.message;
      }

      // 3. Element inside disconnected subtree
      const parent = document.createElement("div");
      const child = document.createElement("div");
      parent.appendChild(child);
      const vt3 = child.startViewTransition();
      let readyErr3: string | null = null;
      try {
        await vt3.ready;
      } catch (e: any) {
        readyErr3 = e.name;
      }
      await vt3.finished;

      return {
        avtImmediate,
        cbRan,
        readyErr1,
        readyErr2,
        ucdErr2,
        finishedErr2,
        readyErr3,
      };
    });

    expect(result.avtImmediate).toBeNull();
    expect(result.cbRan).toBe(true);
    expect(result.readyErr1).toBe("InvalidStateError");
    expect(result.readyErr2).toBe("InvalidStateError");
    expect(result.ucdErr2).toBe("cb-fail");
    expect(result.finishedErr2).toBe("cb-fail");
    expect(result.readyErr3).toBe("InvalidStateError");
  });

  test("It should skip with InvalidStateError for elements not qualifying for layout containment and succeed for qualifying elements", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const span = document.createElement("span");
      span.textContent = "inline";
      document.body.appendChild(span);

      const inlineBlock = document.createElement("span");
      inlineBlock.style.display = "inline-block";
      inlineBlock.textContent = "inline-block";
      document.body.appendChild(inlineBlock);

      const displayNone = document.createElement("div");
      displayNone.style.display = "none";
      document.body.appendChild(displayNone);

      const childOfNone = document.createElement("div");
      displayNone.appendChild(childOfNone);

      const displayContents = document.createElement("div");
      displayContents.style.display = "contents";
      displayContents.textContent = "contents";
      document.body.appendChild(displayContents);

      const table = document.createElement("table");
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.textContent = "cell";
      tr.appendChild(td);
      table.appendChild(tr);
      document.body.appendChild(table);

      const canvas = document.createElement("canvas");
      canvas.width = 50;
      canvas.height = 50;
      document.body.appendChild(canvas);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "50");
      svg.setAttribute("height", "50");
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("width", "50");
      rect.setAttribute("height", "50");
      svg.appendChild(rect);
      document.body.appendChild(svg);

      const run = async (el: Element) => {
        let cbRan = false;
        const vt = el.startViewTransition(() => {
          cbRan = true;
        });
        let readyErr: string | null = null;
        try {
          await vt.ready;
        } catch (e: any) {
          readyErr = e.name;
        }
        await vt.finished;
        return {
          readyErr,
          cbRan,
          avtAfter: el.activeViewTransition,
        };
      };

      return {
        span: await run(span),
        inlineBlock: await run(inlineBlock),
        displayNone: await run(displayNone),
        childOfNone: await run(childOfNone),
        displayContents: await run(displayContents),
        tr: await run(tr),
        td: await run(td),
        canvas: await run(canvas),
        svg: await run(svg),
        rect: await run(rect),
      };
    });

    expect(result.span).toEqual({
      readyErr: "InvalidStateError",
      cbRan: true,
      avtAfter: null,
    });
    expect(result.inlineBlock).toEqual({
      readyErr: null,
      cbRan: true,
      avtAfter: null,
    });
    expect(result.displayNone).toEqual({
      readyErr: "InvalidStateError",
      cbRan: true,
      avtAfter: null,
    });
    expect(result.childOfNone).toEqual({
      readyErr: "InvalidStateError",
      cbRan: true,
      avtAfter: null,
    });
    expect(result.displayContents).toEqual({
      readyErr: "InvalidStateError",
      cbRan: true,
      avtAfter: null,
    });
    expect(result.tr).toEqual({
      readyErr: "InvalidStateError",
      cbRan: true,
      avtAfter: null,
    });
    expect(result.td).toEqual({
      readyErr: null,
      cbRan: true,
      avtAfter: null,
    });
    expect(result.canvas).toEqual({
      readyErr: null,
      cbRan: true,
      avtAfter: null,
    });
    expect(result.svg).toEqual({
      readyErr: null,
      cbRan: true,
      avtAfter: null,
    });
    expect(result.rect).toEqual({
      readyErr: "InvalidStateError",
      cbRan: true,
      avtAfter: null,
    });
  });

  test("It should skip with InvalidStateError if root element stops qualifying during updateCallback", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const div1 = document.createElement("div");
      const div2 = document.createElement("div");
      const div3 = document.createElement("div");
      document.body.appendChild(div1);
      document.body.appendChild(div2);
      document.body.appendChild(div3);

      // 1. Becomes display: inline during callback
      const vt1 = div1.startViewTransition(() => {
        div1.style.display = "inline";
      });
      let err1: string | null = null;
      try {
        await vt1.ready;
      } catch (e: any) {
        err1 = e.name;
      }
      await vt1.finished;

      // 2. Becomes display: none during callback
      const vt2 = div2.startViewTransition(() => {
        div2.style.display = "none";
      });
      let err2: string | null = null;
      try {
        await vt2.ready;
      } catch (e: any) {
        err2 = e.name;
      }
      await vt2.finished;

      // 3. Disconnected during callback
      const vt3 = div3.startViewTransition(() => {
        div3.remove();
      });
      let err3: string | null = null;
      try {
        await vt3.ready;
      } catch (e: any) {
        err3 = e.name;
      }
      await vt3.finished;

      return {
        err1,
        err2,
        err3,
        allCleared:
          div1.activeViewTransition === null &&
          div2.activeViewTransition === null &&
          div3.activeViewTransition === null,
      };
    });

    expect(result.err1).toBe("InvalidStateError");
    expect(result.err2).toBe("InvalidStateError");
    expect(result.err3).toBe("InvalidStateError");
    expect(result.allCleared).toBe(true);
  });
});

test.describe("Granular Mode Interoperability (Native Document VT + Mocked Scoped VT)", () => {
  test("It should allow concurrent native document.startViewTransition and mocked element.startViewTransition", async ({
    page,
  }) => {
    await page.goto("http://localhost:7357/tests/test-page.html");

    const result = await page.evaluate(async () => {
      (window as any).register();

      const outer = document.createElement("div");
      const inner = document.createElement("div");
      outer.appendChild(inner);
      document.body.appendChild(outer);

      const tInner = inner.startViewTransition(() => {});
      await tInner.ready;

      const tDoc = document.startViewTransition(() => {});
      const docRootMatches = tDoc.transitionRoot === document.documentElement;
      const docElAVTMatches =
        document.documentElement.activeViewTransition === tDoc;
      const innerAVTMatches = inner.activeViewTransition === tInner;

      await Promise.all([tInner.finished, tDoc.finished]);

      // Also test document.documentElement.startViewTransition() in granular mode
      const tDocEl = document.documentElement.startViewTransition(() => {});
      const docElDelegates =
        document.activeViewTransition === tDocEl &&
        document.documentElement.activeViewTransition === tDocEl &&
        tDocEl.transitionRoot === document.documentElement;
      await tDocEl.finished;

      return {
        innerInstanceOf: tInner instanceof ViewTransition,
        docInstanceOf: tDoc instanceof ViewTransition,
        docRootMatches,
        docElAVTMatches,
        innerAVTMatches,
        docElDelegates,
        allCleared:
          inner.activeViewTransition === null &&
          document.activeViewTransition === null &&
          document.documentElement.activeViewTransition === null,
      };
    });

    expect(result.innerInstanceOf).toBe(true);
    expect(result.docInstanceOf).toBe(true);
    expect(result.docRootMatches).toBe(true);
    expect(result.docElAVTMatches).toBe(true);
    expect(result.innerAVTMatches).toBe(true);
    expect(result.docElDelegates).toBe(true);
    expect(result.allCleared).toBe(true);
  });
});

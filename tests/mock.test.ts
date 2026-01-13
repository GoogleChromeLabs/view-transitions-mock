/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { register } from "../src";

const nextTick = <T = void>(fn?: () => T): Promise<T> => {
  const p = Promise.resolve();

  return fn ? p.then(fn) : (p as unknown as Promise<T>);
};

describe("View Transitions Mock", () => {
  beforeEach(() => {
    register();
  });

  it("should create a ViewTransition when calling document.startViewTransition", async () => {
    const updateCallback = vi.fn();
    const t = document.startViewTransition(updateCallback);
    expect(t).toBeInstanceOf(ViewTransition);
  });

  it("should execute the DOM update callback", async () => {
    const updateCallback = vi.fn();
    document.startViewTransition(updateCallback);

    await nextTick();
    expect(updateCallback).toHaveBeenCalled();
  });

  it("should set/unset document.activeViewTransition", async () => {
    expect(document.activeViewTransition).toBeNull();

    const updateCallback = vi.fn();
    document.startViewTransition(updateCallback);

    await nextTick();
    expect(document.activeViewTransition).toBeDefined();

    await expect(
      (document.activeViewTransition as ViewTransition).finished,
    ).resolves.toBeUndefined();
    expect(document.activeViewTransition).toBeNull();
  });

  it("should resolve promises in the correct lifecycle order", async () => {
    const transition = document.startViewTransition(() => {
      // Simulate DOM work
    });

    // 1. Check updateCallbackDone first
    await expect(transition.updateCallbackDone).resolves.toBeUndefined();

    // 2. Check ready (simulated via setTimeout(0))
    await expect(transition.ready).resolves.toBeUndefined();

    // 3. Check finished (simulated via setTimeout(100))
    await expect(transition.finished).resolves.toBeUndefined();
  });

  it("should handle transition types correctly (Level 2 Spec)", () => {
    const options: StartViewTransitionOptions = {
      update: () => {},
      types: ["slide-in", "fade-out"],
    };

    const transition = document.startViewTransition(options);

    expect(transition.types.has("slide-in")).toBe(true);
    expect(transition.types.has("fade-out")).toBe(true);
    expect(transition.types.size).toBe(2);
  });

  it("should skip the transition when skipTransition() is called", async () => {
    const transition = document.startViewTransition(() => {});
    transition.skipTransition();

    await expect(transition.ready).rejects.toBeInstanceOf(DOMException);
    await expect(transition.finished).resolves.toBeUndefined();
  });

  // should skip the transition when a new transition is started
});

/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { startViewTransition, getActiveViewTranstion } from "./same-document";

import { ViewTransition } from "./classes/ViewTransition";
import { ViewTransitionTypeSet } from "./classes/ViewTransitionTypeSet";

let registered = false;

// Store native implementations if they exist
const nativeImplementations = {
  ViewTransition: window.ViewTransition,
  ViewTransitionTypeSet: (window as any).ViewTransitionTypeSet,
  startViewTransition: document.startViewTransition,
  activeViewTransition: Reflect.getOwnPropertyDescriptor(
    Document.prototype,
    "activeViewTransition",
  ),
};

const register = (force: boolean = false): void => {
  if (registered) return;

  if (!document.startViewTransition || force) {
    Reflect.defineProperty(window, "ViewTransition", {
      value: ViewTransition,
      configurable: true,
    });

    Reflect.defineProperty(window, "ViewTransitionTypeSet", {
      value: ViewTransitionTypeSet,
      configurable: true,
    });

    Reflect.defineProperty(document, "activeViewTransition", {
      get: getActiveViewTranstion,
      configurable: true,
    });

    Reflect.defineProperty(document, "startViewTransition", {
      value: startViewTransition,
      configurable: true,
      writable: true,
    });

    registered = true;

    console.info("Support for Same-Document View Transitions is now mocked");
  }
};

const unregister = (): void => {
  if (!registered) return;

  if (nativeImplementations.ViewTransition) {
    Reflect.defineProperty(window, "ViewTransition", {
      value: nativeImplementations.ViewTransition,
    });
  } else {
    Reflect.deleteProperty(window, "ViewTransition");
  }

  if (nativeImplementations.ViewTransitionTypeSet) {
    Reflect.defineProperty(window, "ViewTransitionTypeSet", {
      value: nativeImplementations.ViewTransitionTypeSet,
    });
  } else {
    Reflect.deleteProperty(window, "ViewTransitionTypeSet");
  }

  if (nativeImplementations.activeViewTransition) {
    Reflect.defineProperty(
      document,
      "activeViewTransition",
      nativeImplementations.activeViewTransition,
    );
  } else {
    Reflect.deleteProperty(document, "activeViewTransition");
  }

  if (nativeImplementations.startViewTransition) {
    document.startViewTransition = nativeImplementations.startViewTransition;
  } else {
    Reflect.deleteProperty(document, "startViewTransition");
  }

  registered = false;

  console.info("Support for Same-Document View Transitions is no longer mocked");
};

export { register, unregister };

/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { startViewTransition, getActiveViewTranstion } from "./same-document";

import { ViewTransition } from "./classes/ViewTransition";
import { ViewTransitionTypeSet } from "./classes/ViewTransitionTypeSet";

let registered = false;

const register = (force: boolean = false): void => {
  if (registered) return;

  if (!document.startViewTransition || force) {
    Reflect.defineProperty(window, "ViewTransition", {
      value: ViewTransition,
    });

    Reflect.defineProperty(window, "ViewTransitionTypeSet", {
      value: ViewTransitionTypeSet,
    });

    Reflect.defineProperty(document, "activeViewTransition", {
      get: getActiveViewTranstion,
    });

    document.startViewTransition = startViewTransition;

    registered = true;

    console.info("Support for Same-Document View Transitions is now mocked");
  }
};

export { register };

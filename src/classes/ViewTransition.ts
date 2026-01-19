/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import WatchablePromise from "watchable-promise";

import {
  ViewTransition as ViewTransitionInterface,
  ViewTransitionUpdateCallback,
  ViewTransitionPhase,
  possibleViewTransitionPhases,
} from "../types";
import { ViewTransitionTypeSet } from "./ViewTransitionTypeSet";
import { skipTheViewTransition } from "../same-document";

type ResolveFunction = (value: void | PromiseLike<void>) => void;
type RejectFunction = (reason?: any) => void;

let allowClassCreation = false;
const setAllowClassCreation = (value: boolean): void => {
  allowClassCreation = value;
};
export { setAllowClassCreation };

class ViewTransition implements ViewTransitionInterface {
  // The promises and their resolve/reject functions
  #finished: WatchablePromise<void>;
  #ready: WatchablePromise<void>;
  #updateCallbackDone: WatchablePromise<void>;

  #types: ViewTransitionTypeSet;
  #updateCallback: ViewTransitionUpdateCallback | null = null;

  // The phase – One of the possible VT phases, initially "pending-capture"
  #phase = possibleViewTransitionPhases[0];

  constructor() {
    // Prevent externals from creating an instance
    if (!allowClassCreation) {
      throw new TypeError("Illegal constructor");
    }

    // The updateCallbackDone promise.
    this.#updateCallbackDone = new WatchablePromise((resolve, reject) => {});

    // The ready promise.
    this.#ready = new WatchablePromise((resolve, reject) => {});

    // The finished promise.
    this.#finished = new WatchablePromise((resolve, reject) => {});

    // The types
    this.#types = new ViewTransitionTypeSet();
  }

  // @ref https://drafts.csswg.org/css-view-transitions-1/#dom-viewtransition-skiptransition
  skipTransition = (): undefined => {
    // 1. If this’s phase is not "done", then skip the view transition for this with an "AbortError" DOMException.
    if (this.#phase !== "done") {
      skipTheViewTransition(
        this,
        new DOMException(
          "ViewTransition.skipTransition() was called",
          "AbortError",
        ),
      );
    }

    return undefined;
  };

  // @TODO: The spec defines this as Promise<undefined>
  get updateCallbackDone(): WatchablePromise<void> {
    return this.#updateCallbackDone;
  }

  // @TODO: The spec defines this as Promise<undefined>
  get ready(): WatchablePromise<void> {
    return this.#ready;
  }

  // @TODO: The spec defines this as Promise<undefined>
  get finished(): WatchablePromise<void> {
    return this.#finished;
  }

  get types(): ViewTransitionTypeSet {
    return this.#types;
  }

  // @TODO: This should not be exposed
  set phase(phase: ViewTransitionPhase) {
    if (!possibleViewTransitionPhases.includes(phase)) {
      throw new Error("Invalid phase");
    }
    this.#phase = phase;
  }

  // @TODO: This should not be exposed
  get phase(): ViewTransitionPhase {
    return this.#phase;
  }

  // @TODO: This should not be expose
  set updateCallback(callback: ViewTransitionUpdateCallback | null) {
    this.#updateCallback = callback;
  }

  get updateCallback(): ViewTransitionUpdateCallback | null {
    return this.#updateCallback;
  }

  // @TODO: transitionRoot
  // @TODO: waitUntil
}

export { ViewTransition };

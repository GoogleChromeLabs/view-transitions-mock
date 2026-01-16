/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import WatchablePromise from "watchable-promise";

import {
  ViewTransition as ViewTransitionInterface,
  ViewTransitionUpdateCallback,
} from "../types";
import { ViewTransitionTypeSet } from "./ViewTransitionTypeSet";

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
  #updateCallback: ViewTransitionUpdateCallback;

  // We need this flag to be able to skip the transition before it actually starts.
  #isBeingSkipped = false;

  constructor(updateCallback: ViewTransitionUpdateCallback) {
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

    // The updateCallback
    this.#updateCallback = updateCallback;

    // Start the transition
    window.queueMicrotask(this.#start);
  }

  #start = async (): Promise<void> => {
    if (this.#isBeingSkipped == false) {
      try {
        await this.#flushTheUpdateCallbackQueue();
        this.#ready.resolve();
        this.#finished.resolve();
      } catch (e) {
        this.#ready.reject();
        this.#finished.reject();
      }
    }
  };

  // @ref https://drafts.csswg.org/css-view-transitions-1/#dom-viewtransition-skiptransition
  // Spec: If this’s phase is not "done", then skip the view transition for this with an "AbortError" DOMException.
  // @note: We don’t check the phase because we don’t keep track of it. Instead we use isBeingSkipped
  skipTransition = async (): Promise<void> => {
    if (this.#isBeingSkipped) return;

    this.#isBeingSkipped = true;

    // Spec: Reject transition’s ready promise with reason.
    // @TODO: Ready should not reject if already resolved
    await this.#ready.reject(
      new DOMException("Transition was skipped", "AbortError"),
    );

    // Spec: If transition’s phase is before "update-callback-called", then schedule the update callback for transition.
    if (this.#updateCallbackDone.state == "pending") {
      try {
        await this.#flushTheUpdateCallbackQueue();
      } catch (e) {}
    }

    // Spec: Resolve transition’s finished promise with the result of reacting to transition’s update callback done promise
    // If the promise was fulfilled, then return undefined.
    if (this.#updateCallbackDone.state == "fulfilled") {
      await this.#finished.resolve();
    } else {
      this.#finished.reject();
    }
  };

  #flushTheUpdateCallbackQueue = async (): Promise<void> => {
    try {
      this.#updateCallback();

      this.#updateCallbackDone.resolve();
    } catch (e) {
      this.#updateCallbackDone.reject();
    }

    return this.#updateCallbackDone;
  };

  get finished(): Promise<void> {
    return this.#finished;
  }

  get ready(): Promise<void> {
    return this.#ready;
  }

  get updateCallbackDone(): Promise<void> {
    return this.#updateCallbackDone;
  }

  get types(): ViewTransitionTypeSet {
    return this.#types;
  }
}

export { ViewTransition };

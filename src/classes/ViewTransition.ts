import {
  ViewTransition as ViewTransitionInterface,
  ViewTransitionUpdateCallback,
} from "../types";
import { ViewTransitionTypeSet } from "./ViewTransitionTypeSet";

type ResolveFunction = (value: void | PromiseLike<void>) => void;
type RejectFunction = (reason?: any) => void;
type PromiseStatus = "pending" | "resolved" | "rejected";

class ViewTransition implements ViewTransitionInterface {
  // The promises and their resolve/reject functions
  #finished: Promise<void>;
  // @ts-ignore
  #resolveFinished: ResolveFunction;
  // @ts-ignore
  #rejectFinished: RejectFunction;

  #ready: Promise<void>;
  // @ts-ignore
  #resolveReady: ResolveFunction;
  // @ts-ignore
  #rejectReady: RejectFunction;

  #updateCallbackDone: Promise<void>;
  // @ts-ignore
  #resolveUpdateCallbackDone: ResolveFunction;
  // @ts-ignore
  #rejectUpdateCallbackDone: RejectFunction;
  #updateCallbackState: PromiseStatus;

  #types: ViewTransitionTypeSet;
  #updateCallback: ViewTransitionUpdateCallback;

  // We need this flag to be able to skip the transition before it actually starts.
  #isBeingSkipped = false;

  constructor(updateCallback: ViewTransitionUpdateCallback) {
    // The updateCallbackDone promise.
    this.#updateCallbackState = "pending";
    this.#updateCallbackDone = new Promise((res, rej) => {
      this.#resolveUpdateCallbackDone = res;
      this.#rejectUpdateCallbackDone = rej;
    });

    // The ready promise.
    this.#ready = new Promise((res, rej) => {
      this.#resolveReady = res;
      this.#rejectReady = rej;
    });

    // The finished promise.
    this.#finished = new Promise((res, rej) => {
      this.#resolveFinished = res;
      this.#rejectFinished = rej;
    });

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
        this.#resolveReady();
        this.#resolveFinished();
      } catch (e) {
        this.#rejectReady();
        this.#rejectFinished();
      }
    }
  };

  // @ref https://drafts.csswg.org/css-view-transitions-1/#dom-viewtransition-skiptransition
  // Spec: If this’s phase is not "done", then skip the view transition for this with an "AbortError" DOMException.
  skipTransition = async (): Promise<void> => {
    this.#isBeingSkipped = true;

    // Spec: Reject transition’s ready promise with reason.
    // @TODO: Ready should not reject if already resolved
    await this.#rejectReady(
      new DOMException("Transition was skipped", "AbortError"),
    );

    // Spec: If transition’s phase is before "update-callback-called", then schedule the update callback for transition.
    if (this.#updateCallbackState == "pending") {
      try {
        await this.#flushTheUpdateCallbackQueue();
      } catch (e) {}
    }

    // Spec: Resolve transition’s finished promise with the result of reacting to transition’s update callback done promise
    if (this.#updateCallbackState == "resolved") {
      this.#resolveFinished();
    } else {
      this.#rejectFinished();
    }
  };

  #flushTheUpdateCallbackQueue = async (): Promise<void> => {
    try {
      this.#updateCallback();

      this.#updateCallbackState = "resolved";
      this.#resolveUpdateCallbackDone();
    } catch (e) {
      this.#updateCallbackState = "rejected";
      this.#rejectUpdateCallbackDone();
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

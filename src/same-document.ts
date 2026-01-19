/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import WatchablePromise from "watchable-promise";

import {
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
  possibleViewTransitionPhases,
} from "./types";
import {
  ViewTransition,
  setAllowClassCreation,
} from "./classes/ViewTransition";

let activeViewTransition: ViewTransition | null = null;

// @TODO: Implement https://drafts.csswg.org/css-view-transitions-1/#page-visibility-change-steps

// update callback queue – A list, initially empty.
let updateCallbackQueue: any[] = [];

let renderingSuppression = false;

const startViewTransition = (
  params?: ViewTransitionUpdateCallback | StartViewTransitionOptions,
): ViewTransition => {
  let callback: ViewTransitionUpdateCallback | null | undefined = null;
  let types: string[] = [];

  // Extract the callback and types
  if (typeof params === "function") {
    callback = params;
  } else if (params && typeof params === "object") {
    callback = params.update;
    types = params.types ?? [];
  }

  // @TODO: This is not spec compliant. Remove this.
  // Make sure there is a callback
  if (!callback) {
    callback = () => {};
  }

  // @ref https://drafts.csswg.org/css-view-transitions-1/#ViewTransition-prepare

  // 1. Let transition be a new ViewTransition object in this’s relevant Realm.
  setAllowClassCreation(true);
  const transition = new ViewTransition();
  setAllowClassCreation(false);
  types.forEach((t) => transition.types.add(t));

  // 2. If updateCallback is provided, set transition’s update callback to updateCallback.
  transition.updateCallback = callback;

  // 3. Let document be this’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 4. If document’s visibility state is "hidden", then skip transition with an "InvalidStateError" DOMException, and return transition.
  if (document.visibilityState === "hidden") {
    skipTheViewTransition(
      transition,
      new DOMException(
        'The document\'s visibility state is "hidden"',
        "InvalidStateError",
      ),
    );
    return transition;
  }

  // 5. If document’s active view transition is not null, then skip that view transition with an "AbortError" DOMException in this’s relevant Realm.
  if (activeViewTransition) {
    skipTheViewTransition(
      activeViewTransition,
      new DOMException(
        "Document.startViewTransition() was called",
        "AbortError",
      ),
    );
    activeViewTransition = null;
  }

  // 6. Set document’s active view transition to transition.
  // NOTE: The view transition process continues in setup view transition, via perform pending transition operations.
  activeViewTransition = transition;
  window.queueMicrotask(async () => {
    await performPendingOperations();
  });

  // 7. Return transition.
  return transition;
};

const getActiveViewTranstion = (): ViewTransition | null => {
  return activeViewTransition;
};

const performPendingOperations = async () => {
  // 1. If document’s active view transition is not null, then:
  if (activeViewTransition) {
    // 1.1. If document’s active view transition’s phase is "pending-capture", then setup view transition for document’s active view transition.
    if (activeViewTransition.phase === "pending-capture") {
      await setupViewTransition(activeViewTransition);
    }

    // 1.2 Otherwise, if document’s active view transition’s phase is "animating", then handle transition frame for document’s active view transition.
    if (activeViewTransition.phase === "animating") {
      // @TODO: I think we can diverge from the spec here and replace the call to handleTransitionFrame
      // by a callback that awaits for Promise.allSettled(allAnimations.map(a => a.finished)).
      // When doing so, we could return early here, bypassing the rAF below.
      //
      // However, for this to work correctly it would also require a window.resize listener to
      // make sure the activeViewTransition gets skipped when the VP (and thus SCB changes)
      // This check is also part of handleTransitionFrame.
      await handleTransitionFrame(activeViewTransition);
    }

    // @NOTE: The spec says performPendingOperations should be implemented
    // as part of the of the “update the rendering loop” from the html spec.
    // To fake this, We need to do this non-spec compliant call here,
    // to make sure performPendingOperations runs at the next frame.
    requestAnimationFrame(async () => {
      await performPendingOperations();
    });
  }
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#setup-view-transition-algorithm instead
const setupViewTransition = async (transition: ViewTransition) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Flush the update callback queue.
  await flushTheUpdateCallbackQueue();

  // 3. Capture the old state for transition.
  // If failure is returned, then skip the view transition for transition with an "InvalidStateError" DOMException
  // in transition’s relevant Realm, and return.
  // @NOTIMPLEMENTED

  // 4. Set document’s rendering suppression for view transitions to true.
  renderingSuppression = true;

  // 5. Queue a global task on the DOM manipulation task source, given transition’s relevant global object,
  // to perform the following steps:
  window.queueMicrotask(async () => {
    // 1. If transition’s phase is "done", then abort these steps.
    if (transition.phase === "done") return;

    // 2. schedule the update callback for transition.
    scheduleTheUpdateCallback(transition);

    // 3. Flush the update callback queue.
    // @NOTIMPLMENTED – As per https://github.com/w3c/csswg-drafts/issues/11987, it is noticed that
    // scheduleTheUpdateCallback includes a call to flushTheUpdateCallbackQueue, which makes this call
    // obsolute. Furthermore, when enabling this line right here, there is an assertion that fails.
    // await flushTheUpdateCallbackQueue();
  });
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#schedule-the-update-callback
const scheduleTheUpdateCallback = (transition: ViewTransition) => {
  // 1. Append transition to transition’s relevant settings object’s update callback queue.
  // @TODO: What is “relevant settings object”?
  // @TODO: Monitor https://github.com/w3c/csswg-drafts/issues/11986
  updateCallbackQueue.push(transition);

  // 2. Queue a global task on the DOM manipulation task source, given transition’s relevant global object, to flush the update callback queue.
  window.queueMicrotask(async () => {
    await flushTheUpdateCallbackQueue();
  });
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#skip-the-view-transition
const skipTheViewTransition = async (
  transition: ViewTransition,
  reason?: any,
) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Assert: transition’s phase is not "done".
  if (transition.phase === "done") {
    throw new Error('Assertion failed: transition’s phase is not "done"');
  }

  // 3. If transition’s phase is before "update-callback-called", then schedule the update callback for transition.
  if (
    possibleViewTransitionPhases.indexOf(transition.phase) <
    possibleViewTransitionPhases.indexOf("update-callback-called")
  ) {
    scheduleTheUpdateCallback(transition);
  }

  // 4. Set rendering suppression for view transitions to false.
  renderingSuppression = false;

  // 5. If document’s active view transition is transition, Clear view transition transition.
  if (document.activeViewTransition === transition) {
    clearViewTransition(transition);
  }

  // 6. Set transition’s phase to "done".
  transition.phase = "done";

  // 7. Reject transition’s ready promise with reason.
  // The ready promise may already be resolved at this point, if skipTransition() is called after we start animating.
  // In that case, this step is a no-op.
  await transition.ready.reject(reason);

  // 8. Resolve transition’s finished promise with the result of reacting to transition’s update callback done promise
  //   - If the promise was fulfilled, then return undefined.
  // @TODO: Which promise is “the promise”? The finished one or the updateCallbackDone one?
  // @TODO: Monitor https://github.com/w3c/csswg-drafts/issues/11990
  await transition.updateCallbackDone.resolve();

  if (transition.updateCallbackDone.state === "fulfilled") {
    await transition.finished.resolve(transition.updateCallbackDone.value);
  } else {
    await transition.finished.reject();
  }

  // @TODO: Do we need to return something else when it is not fullfilled?
  if (transition.finished.state === "fulfilled") return undefined;
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#flush-the-update-callback-queue
//
// @TODO: Monitor https://github.com/w3c/csswg-drafts/issues/11986
// This function takes a document but it doesn’t really do anything
const flushTheUpdateCallbackQueue = async () => {
  // 1. For each transition in document’s update callback queue, call the update callback given transition.
  // @TODO: Should we try-catch this?
  for (const transition of updateCallbackQueue) {
    await callTheUpdateCallback(transition);
  }

  // 2. Set document’s update callback queue to an empty list.
  updateCallbackQueue = [];
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#handle-transition-frame
const handleTransitionFrame = async (transition: ViewTransition) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Let hasActiveAnimations be a boolean, initially false.
  let hasActiveAnimations = false;

  // 3. For each element of transition’s transition root pseudo-element’s inclusive descendants:
  // 3.1 For each animation whose timeline is a document timeline associated with document, and contains at least one associated effect whose effect target is element, set hasActiveAnimations to true if any of the following conditions are true:
  // - animation’s play state is paused or running.
  // - document’s pending animation event queue has any events associated with animation.
  // @NOTIMPLEMENTED

  // 4. If hasActiveAnimations is false:
  if (hasActiveAnimations === false) {
    // 4.1 Set transition’s phase to "done".
    transition.phase = "done";

    // 4.2 Clear view transition transition.
    clearViewTransition(transition);

    // 4.3 Resolve transition’s finished promise.
    await transition.finished.resolve();

    // 4.4 Return.
    return;
  }

  // 5. If transition’s initial snapshot containing block size is not equal to the snapshot containing block size,
  // then skip the view transition for transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @TODO: Implement this

  // 6. Update pseudo-element styles for transition.
  // If failure is returned, then skip the view transition for transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @NOTIMPLEMENTED
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#call-the-update-callback
const callTheUpdateCallback = async (transition: ViewTransition) => {
  // 1. Assert: transition’s phase is "done", or before "update-callback-called".
  if (
    !(
      transition.phase === "done" ||
      possibleViewTransitionPhases.indexOf(transition.phase) <
        possibleViewTransitionPhases.indexOf("update-callback-called")
    )
  ) {
    debugger;
    throw new Error(
      `Assertion failed: transition’s phase is "done", or before "update-callback-called". The transition’s phase is "${transition.phase}"`,
    );
  }

  // 2. If transition’s phase is not "done", then set transition’s phase to "update-callback-called".
  if (transition.phase !== "done") {
    transition.phase = "update-callback-called";
  }

  // 3. Let callbackPromise be null.
  let callbackPromise = null;

  // 4. If transition’s update callback is null, then set callbackPromise to a promise resolved with undefined, in transition’s relevant Realm.
  if (transition.updateCallback === null) {
    callbackPromise = new WatchablePromise((resolve, reject) => {});
    await callbackPromise.resolve(undefined);
  }

  // 5. Otherwise, set callbackPromise to the result of invoking transition’s update callback.
  else {
    callbackPromise = new WatchablePromise((resolve, reject) => {});
    await callbackPromise.resolve(await transition.updateCallback());
  }

  // 6. Let fulfillSteps be the following steps:
  let fulfillSteps = async () => {
    // 1. Resolve transition’s update callback done promise with undefined.
    await transition.updateCallbackDone.resolve();

    // 2. Activate transition.
    await activateViewTransition(transition);
  };

  // 7. Let rejectSteps be the following steps given reason:
  let rejectSteps = async (reason: any) => {
    // 1. Reject transition’s update callback done promise with reason.
    await transition.updateCallbackDone.reject(reason);

    // 2. If transition’s phase is "done", then return.
    if (transition.phase === "done") return;

    // 3. Mark as handled transition’s ready promise.
    // @ref: https://webidl.spec.whatwg.org/#mark-a-promise-as-handled
    await transition.ready.resolve(); // @TODO: Is this correct?

    // 4. Skip the view transition transition with reason.
    await skipTheViewTransition(transition, reason);
  };

  // 8. React to callbackPromise with fulfillSteps and rejectSteps.
  // @TODO: Monitor https://github.com/w3c/csswg-drafts/issues/11990
  if (callbackPromise.state === "fulfilled") {
    await fulfillSteps();
  } else {
    await rejectSteps(callbackPromise.value);
  }

  // 9. To skip a transition after a timeout, the user agent may perform the following steps in parallel:
  // @TODO

  // 9.1. Wait for an implementation-defined duration.
  // @TODO

  // 9.2. Queue a global task on the DOM manipulation task source, given transition’s relevant global object, to perform the following steps:
  // @TODO

  // 9.2.1. If transition’s phase is "done", then return.
  // @TODO

  // 9.2.2. Skip transition with a "TimeoutError" DOMException.
  // @TODO
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#activate-view-transition
const activateViewTransition = async (transition: ViewTransition) => {
  // 1. If transition’s phase is "done", then return.
  if (transition.phase === "done") return;

  // 2. Set transition’s relevant global object’s associated document’s rendering suppression for view transitions to false.
  renderingSuppression = false;

  // 3. If transition’s initial snapshot containing block size is not equal to the snapshot containing block size, then skip transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @TODO: Implement this

  // 4. Capture the new state for transition.
  // If failure is returned, then skip transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @NOTIMPLEMENTED

  // 5. For each capturedElement of transition’s named elements' values:
  // @NOTIMPLEMENTED

  // 6. Setup transition pseudo-elements for transition.
  // @NOTIMPLEMENTED

  // 7. Update pseudo-element styles for transition.
  // If failure is returned, then skip the view transition for transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @NOTIMPLEMENTED

  // 8. Set transition’s phase to "animating".
  transition.phase = "animating";

  // 9. Resolve transition’s ready promise.
  await transition.ready.resolve();
};

// @ref https://drafts.csswg.org/css-view-transitions-1/#clear-view-transition
const clearViewTransition = (transition: ViewTransition) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Assert: document’s active view transition is transition.
  if (transition !== activeViewTransition) {
    throw new Error(
      "Assertion failed: transition !== document.activeViewTransition",
    );
  }

  // 3. For each capturedElement of transition’s named elements' values:
  // @NOTIMPLEMENTED

  // 4. Set document’s show view transition tree to false.
  // @NOTIMPLEMENTED

  // 5. Set document’s active view transition to null.
  activeViewTransition = null;
};

export { startViewTransition, getActiveViewTranstion, skipTheViewTransition };

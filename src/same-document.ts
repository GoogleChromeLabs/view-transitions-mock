/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
  possibleViewTransitionPhases,
} from "./types";
import {
  ViewTransition,
  setAllowClassCreation,
} from "./classes/ViewTransition";

// Document’s active view transition
let documentActiveViewTransition: ViewTransition | null = null;

// Elements’ active view transitions (preserves creation order)
const elementActiveViewTransitions = new Map<Element, ViewTransition>();

// Track which transitions have started setup or had their update callback scheduled
const setupInitiated = new WeakSet<ViewTransition>();
const updateCallbackScheduled = new WeakSet<ViewTransition>();

// @TODO: Implement https://drafts.csswg.org/css-view-transitions-1/#page-visibility-change-steps

// update callback queue – A list, initially empty.
let updateCallbackQueue: ViewTransition[] = [];

let renderingSuppression = false;

// Scheduling flags to avoid duplicate microtask / rAF loops
let pendingSetupScheduled = false;
let flushQueueScheduled = false;
let rafScheduled = false;

// Tracks whether document.startViewTransition is mocked (vs native)
let documentMocked = false;
const setDocumentMocked = (value: boolean): void => {
  documentMocked = value;
};

// Display values that never qualify for layout containment
// @ref https://drafts.csswg.org/css-view-transitions-2/#dom-element-startviewtransition (step 4)
const DISALLOWED_DISPLAY_VALUES = new Set([
  "none",
  "contents",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
  "table-row",
  "table-column-group",
  "table-column",
  "ruby-base",
  "ruby-text",
  "ruby-base-container",
  "ruby-text-container",
]);

// HTML replaced elements that generate an atomic inline-level box even when display is "inline"
const ATOMIC_INLINE_HTML_TAGS = new Set([
  "IMG",
  "IFRAME",
  "EMBED",
  "OBJECT",
  "VIDEO",
  "AUDIO",
  "CANVAS",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "METER",
  "PROGRESS",
]);

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

// Checks whether an element has a rendered principal box that qualifies for layout containment.
// @ref https://drafts.csswg.org/css-view-transitions-2/#dom-element-startviewtransition (step 4)
const canHostViewTransition = (element: Element | null): boolean => {
  if (!element || !element.isConnected) {
    return false;
  }

  // Only outermost <svg> elements qualify for layout containment; inner SVG elements do not.
  if (element.namespaceURI === SVG_NAMESPACE) {
    if (
      element.localName !== "svg" ||
      element.parentElement?.namespaceURI === SVG_NAMESPACE
    ) {
      return false;
    }
  }

  const computedStyle = window.getComputedStyle(element);
  const display = computedStyle.display;

  if (!display || DISALLOWED_DISPLAY_VALUES.has(display)) {
    return false;
  }

  // Non-atomic inline-level boxes do not qualify for layout containment.
  if (display === "inline") {
    const isOutermostSvg =
      element.namespaceURI === SVG_NAMESPACE && element.localName === "svg";
    const isAtomicInlineHtml =
      element.namespaceURI === HTML_NAMESPACE &&
      ATOMIC_INLINE_HTML_TAGS.has(element.tagName);

    if (!isOutermostSvg && !isAtomicInlineHtml) {
      return false;
    }
  }

  // An element with an ancestor that has display: none generates no box.
  if (element.getClientRects().length === 0) {
    return false;
  }

  // An element with a flat-tree ancestor that skips its contents (content-visibility: hidden) is not rendered.
  let parent = element.parentElement;
  while (parent) {
    if (
      window.getComputedStyle(parent).getPropertyValue("content-visibility") ===
      "hidden"
    ) {
      return false;
    }
    parent = parent.parentElement;
  }

  return true;
};

// Collects all active transitions on document and elements without duplicates.
// @ref https://drafts.csswg.org/css-view-transitions-2/#perform-pending-transition-operations
const getActiveTransitions = (): ViewTransition[] => {
  const transitions: ViewTransition[] = [];

  if (documentActiveViewTransition) {
    transitions.push(documentActiveViewTransition);
  }

  for (const transition of elementActiveViewTransitions.values()) {
    if (!transitions.includes(transition)) {
      transitions.push(transition);
    }
  }

  return transitions;
};

function startViewTransition(
  this: Document | Element,
  params?: ViewTransitionUpdateCallback | StartViewTransitionOptions,
): ViewTransition {
  const isDocumentCall = this === window.document;
  if (!isDocumentCall && !(this instanceof Element)) {
    throw new TypeError("Illegal invocation");
  }

  // When only Element-Scoped View Transitions are mocked (granular mode),
  // calling document.documentElement.startViewTransition() delegates to native document.startViewTransition()
  // because transitions on the document root element are global view transitions.
  if (this === window.document.documentElement && !documentMocked) {
    return (params !== undefined
      ? window.document.startViewTransition(params)
      : window.document.startViewTransition()) as unknown as ViewTransition;
  }

  // @ref https://drafts.csswg.org/css-view-transitions-2/#dom-document-startviewtransition
  // Perform the Element startViewTransition() method steps for the document root element.
  const rootElement: Element | null = isDocumentCall
    ? window.document.documentElement
    : (this as Element);

  let updateCallback: ViewTransitionUpdateCallback | null | undefined = null;

  // @ref https://drafts.csswg.org/css-view-transitions-2/#dom-element-startviewtransition

  // 1. Let document be this’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Let viewTransition be a new ViewTransition object in document’s relevant Realm, with root element set to this.
  setAllowClassCreation(true);
  const transition = new ViewTransition();
  setAllowClassCreation(false);
  transition.transitionRoot = rootElement;

  // 3. If callbackOptions is a ViewTransitionUpdateCallback, set viewTransition’s update callback to callbackOptions.
  // Otherwise, if callbackOptions is a StartViewTransitionOptions, then set viewTransition’s update callback to callbackOptions’s update.
  if (typeof params === "function") {
    updateCallback = params;
  } else if (params && typeof params === "object") {
    updateCallback = params.update;
  }
  if (updateCallback) {
    transition.updateCallback = updateCallback;
  }

  // 4. If this is disconnected (or document has no root element), skip viewTransition immediately
  // with an "InvalidStateError" DOMException, and return viewTransition.
  // (Layout-dependent checks for rendered principal box / layout containment run during capture in setupViewTransition & activateViewTransition.)
  if (!rootElement || !rootElement.isConnected) {
    skipTheViewTransition(
      transition,
      new DOMException(
        "Skipped ViewTransition because root element is not connected",
        "InvalidStateError",
      ),
    );
    return transition;
  }

  // 5. If this is not the document root element, force this to have both layout containment
  // and view transition scoping for the duration of the transition.
  // @NOTIMPLEMENTED (non-visual mock)

  // 6. If document’s active view transition is not null and its outbound post-capture steps is not null, then:
  // 6.1 Skip viewTransition with an "InvalidStateError" DOMException.
  // 6.2 Return viewTransition.
  // @NOTIMPLEMENTED

  // 7. If this’s active view transition is not null, then skip that view transition with an "AbortError" DOMException in this’s relevant Realm.
  const existingTransition =
    elementActiveViewTransitions.get(rootElement) ??
    (rootElement === window.document.documentElement
      ? documentActiveViewTransition
      : null);

  if (existingTransition) {
    skipTheViewTransition(
      existingTransition,
      new DOMException(
        "Skipped ViewTransition due to another transition starting",
        "AbortError",
      ),
    );
  }

  // 8. Set this’s active view transition to viewTransition.
  elementActiveViewTransitions.set(rootElement, transition);

  // 9. If this is the document root element, set document’s active view transition to viewTransition.
  if (rootElement === window.document.documentElement) {
    documentActiveViewTransition = transition;
  }

  // NOTE: The view transition process continues in setup view transition, via perform pending transition operations.
  schedulePendingSetup();

  // 10. If callbackOptions is a StartViewTransitionOptions, set viewTransition’s active types to a clone of types as a set.
  if (params && typeof params === "object" && params.types) {
    transition.types = params.types;
  }

  // 11. Return transition.
  return transition;
}

function getActiveViewTransition(
  this: Document | Element,
): ViewTransition | null {
  if (this === window.document) {
    return documentActiveViewTransition;
  }

  if (!(this instanceof Element)) {
    throw new TypeError("Illegal invocation");
  }

  // In granular mode (native Document VT + mocked Element VT),
  // document.documentElement.activeViewTransition reflects native document.activeViewTransition.
  if (this === window.document.documentElement && !documentMocked) {
    return (window.document.activeViewTransition ??
      null) as unknown as ViewTransition | null;
  }

  return elementActiveViewTransitions.get(this) ?? null;
}

const schedulePendingSetup = () => {
  if (pendingSetupScheduled) return;
  pendingSetupScheduled = true;

  window.queueMicrotask(() => {
    pendingSetupScheduled = false;
    performPendingSetup();
  });
};

const performPendingSetup = () => {
  const transitions = getActiveTransitions();

  for (const transition of transitions) {
    if (transition.phase === "done") continue;

    if (
      transition.phase === "pending-capture" &&
      !setupInitiated.has(transition)
    ) {
      setupInitiated.add(transition);
      setupViewTransition(transition);
    }
  }
};

const scheduleAnimationFrame = () => {
  if (rafScheduled) return;
  rafScheduled = true;

  // @NOTE: The spec says performPendingOperations should be implemented
  // as part of the “update the rendering loop” from the html spec.
  // To fake this, we schedule a rAF so animating transitions finish on the next frame.
  requestAnimationFrame(() => {
    rafScheduled = false;
    performAnimationFrame();
  });
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#perform-pending-transition-operations
const performAnimationFrame = () => {
  const transitions = getActiveTransitions();

  for (const transition of transitions) {
    // 4.1. If transition’s phase is "done", then continue.
    if (transition.phase === "done") continue;

    // 4.2. If transition’s phase is "pending-capture", then setup view transition for transition.
    if (
      transition.phase === "pending-capture" &&
      !setupInitiated.has(transition)
    ) {
      setupInitiated.add(transition);
      setupViewTransition(transition);
    }
    // 4.3. Otherwise, if transition’s phase is "animating", then handle transition frame for transition.
    else if (transition.phase === "animating") {
      handleTransitionFrame(transition);
    }
  }

  // Keep the rendering loop alive only if transitions are still animating.
  if (getActiveTransitions().some((t) => t.phase === "animating")) {
    scheduleAnimationFrame();
  }
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#setup-view-transition-algorithm
const setupViewTransition = (transition: ViewTransition) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Flush the update callback queue.
  flushTheUpdateCallbackQueue();

  // Abort if flushing a previous update callback skipped or finished this transition.
  if (transition.phase === "done") return;

  // 3. Capture the old state for transition.
  // Verify the root element has a rendered principal box qualifying for layout containment.
  if (!canHostViewTransition(transition.transitionRoot)) {
    skipTheViewTransition(
      transition,
      new DOMException(
        "Skipped ViewTransition because root element does not qualify for layout containment",
        "InvalidStateError",
      ),
    );
    return;
  }

  // 4. Set document’s rendering suppression for view transitions to true.
  renderingSuppression = true;

  // 5. Queue a global task on the DOM manipulation task source, given transition’s relevant global object,
  // to perform the following steps:
  window.queueMicrotask(() => {
    // 5.1. If transition’s phase is "done", then abort these steps.
    if (transition.phase === "done") return;

    // 5.2. Schedule the update callback for transition.
    scheduleTheUpdateCallback(transition);

    // 5.3. Flush the update callback queue.
    // @NOTIMPLEMENTED – As per https://github.com/w3c/csswg-drafts/issues/11987,
    // scheduleTheUpdateCallback queues flushing the update callback queue.
  });
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#schedule-the-update-callback
const scheduleTheUpdateCallback = (transition: ViewTransition) => {
  // Ensure each transition’s update callback is scheduled at most once.
  if (updateCallbackScheduled.has(transition)) return;
  updateCallbackScheduled.add(transition);

  // 1. Append transition to transition’s relevant settings object’s update callback queue.
  updateCallbackQueue.push(transition);

  // 2. Queue a global task on the DOM manipulation task source, given transition’s relevant global object,
  // to flush the update callback queue.
  // Deferring by one extra microtask ensures microtasks queued synchronously during skipTheViewTransition
  // (such as transition.ready rejection handlers) run before the update callback begins.
  if (!flushQueueScheduled) {
    flushQueueScheduled = true;
    window.queueMicrotask(() => {
      window.queueMicrotask(() => {
        flushQueueScheduled = false;
        flushTheUpdateCallbackQueue();
      });
    });
  }
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#skip-the-view-transition
const skipTheViewTransition = (
  transition: ViewTransition,
  reason?: any,
): void => {
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

  // 5. If transition’s root element’s active view transition is transition
  // or document’s active view transition is transition, clear view transition of transition.
  const rootElement = transition.transitionRoot;
  if (
    (rootElement !== null &&
      elementActiveViewTransitions.get(rootElement) === transition) ||
    documentActiveViewTransition === transition
  ) {
    clearViewTransition(transition);
  }

  // 6. Set transition’s phase to "done".
  transition.phase = "done";

  // 7. Reject transition’s ready promise with reason.
  // The ready promise may already be resolved at this point, if skipTransition() is called after we start animating.
  // In that case, this step is a no-op.
  transition.ready.reject(reason);

  // 8. Resolve transition’s finished promise with the result of reacting to transition’s update callback done promise:
  //   - If the promise was fulfilled, then return undefined.
  //   - If the promise was rejected, finished rejects with the same reason.
  transition.updateCallbackDone.then(
    () => {
      transition.finished.resolve(undefined);
    },
    (error) => {
      transition.finished.reject(error);
    },
  );
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#flush-the-update-callback-queue
const flushTheUpdateCallbackQueue = () => {
  // Snapshot and clear queue before iterating so re-entrant or concurrent calls
  // never invoke a transition’s update callback twice.
  const queue = updateCallbackQueue;
  updateCallbackQueue = [];

  // 1. For each transition in document’s update callback queue, call the update callback given transition.
  for (const transition of queue) {
    callTheUpdateCallback(transition);
  }
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#handle-transition-frame
const handleTransitionFrame = (transition: ViewTransition) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  // 2. Let hasActiveAnimations be a boolean, initially false.
  const hasActiveAnimations = false;

  // 3. For each element of transition’s transition root pseudo-element’s inclusive descendants:
  // @NOTIMPLEMENTED

  // 4. If hasActiveAnimations is false:
  if (hasActiveAnimations === false) {
    // 4.1 Set transition’s phase to "done".
    transition.phase = "done";

    // 4.2 Clear view transition transition.
    clearViewTransition(transition);

    // 4.3 Resolve transition’s finished promise.
    transition.finished.resolve(undefined);

    // 4.4 Return.
    return;
  }

  // 5. If transition’s initial snapshot containing block size is not equal to the snapshot containing block size,
  // then skip the view transition for transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @TODO: Implement this

  // 6. Update pseudo-element styles for transition.
  // @NOTIMPLEMENTED
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#call-the-update-callback
const callTheUpdateCallback = (transition: ViewTransition) => {
  // 1. Assert: transition’s phase is "done", or before "update-callback-called".
  if (
    !(
      transition.phase === "done" ||
      possibleViewTransitionPhases.indexOf(transition.phase) <
        possibleViewTransitionPhases.indexOf("update-callback-called")
    )
  ) {
    throw new Error(
      `Assertion failed: transition’s phase is "done", or before "update-callback-called". The transition’s phase is "${transition.phase}"`,
    );
  }

  // 2. If transition’s phase is not "done", then set transition’s phase to "update-callback-called".
  if (transition.phase !== "done") {
    transition.phase = "update-callback-called";
  }

  // 3-5. Let callbackPromise be a promise resolved with undefined if update callback is null,
  // otherwise the result of invoking transition’s update callback.
  let callbackPromise: Promise<unknown>;

  if (transition.updateCallback === null) {
    callbackPromise = Promise.resolve(undefined);
  } else {
    try {
      callbackPromise = Promise.resolve(transition.updateCallback());
    } catch (error) {
      callbackPromise = Promise.reject(error);
    }
  }

  // 6. Let fulfillSteps be the following steps:
  const fulfillSteps = () => {
    // 6.1. Resolve transition’s update callback done promise with undefined.
    transition.updateCallbackDone.resolve(undefined);

    // 6.2. Activate transition.
    activateViewTransition(transition);
  };

  // 7. Let rejectSteps be the following steps given reason:
  const rejectSteps = (reason: any) => {
    // 7.1. Reject transition’s update callback done promise with reason.
    transition.updateCallbackDone.reject(reason);

    // 7.2. If transition’s phase is "done", then return.
    if (transition.phase === "done") return;

    // 7.3. Mark as handled transition’s ready promise.
    // (Already marked as handled by WatchablePromise’s internal .then())

    // 7.4. Skip the view transition transition with reason.
    skipTheViewTransition(transition, reason);
  };

  // 8. React to callbackPromise with fulfillSteps and rejectSteps.
  callbackPromise.then(fulfillSteps, rejectSteps);

  // 9. To skip a transition after a timeout, the user agent may perform the following steps in parallel:
  // @TODO
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#activate-view-transition
const activateViewTransition = (transition: ViewTransition) => {
  // 1. If transition’s phase is "done", then return.
  if (transition.phase === "done") return;

  // 2. Set transition’s relevant global object’s associated document’s rendering suppression for view transitions to false.
  renderingSuppression = false;

  // 3. If transition’s initial snapshot containing block size is not equal to the snapshot containing block size,
  // then skip transition with an "InvalidStateError" DOMException in transition’s relevant Realm, and return.
  // @TODO: Implement this

  // 4. Capture the new state for transition.
  // Verify the root element still qualifies for layout containment after the update callback ran.
  if (!canHostViewTransition(transition.transitionRoot)) {
    skipTheViewTransition(
      transition,
      new DOMException(
        "Skipped ViewTransition because root element does not qualify for layout containment",
        "InvalidStateError",
      ),
    );
    return;
  }

  // 5-7. Named elements, pseudo-elements, and styles.
  // @NOTIMPLEMENTED

  // 8. Set transition’s phase to "animating".
  transition.phase = "animating";

  // 9. Resolve transition’s ready promise.
  transition.ready.resolve(undefined);

  // Schedule animation frame so handleTransitionFrame finishes the transition on the next frame.
  scheduleAnimationFrame();
};

// @ref https://drafts.csswg.org/css-view-transitions-2/#clear-view-transition
const clearViewTransition = (transition: ViewTransition) => {
  // 1. Let document be transition’s relevant global object’s associated document.
  // @NOTIMPLEMENTED

  const rootElement = transition.transitionRoot;
  const isElementActive =
    rootElement !== null &&
    elementActiveViewTransitions.get(rootElement) === transition;
  const isDocumentActive = documentActiveViewTransition === transition;

  // 2. Assert: transition’s root element’s active view transition is transition
  // or document’s active view transition is transition.
  if (!isElementActive && !isDocumentActive) {
    throw new Error(
      "Assertion failed: transition is not the active view transition",
    );
  }

  // 3. For each capturedElement of transition’s named elements’ values:
  // @NOTIMPLEMENTED

  // 4. Remove all children of the ::view-transition pseudo-element on transition’s root element.
  // @NOTIMPLEMENTED

  // 5. If transition’s root element is not null, set transition’s root element’s active view transition to null.
  if (isElementActive && rootElement) {
    elementActiveViewTransitions.delete(rootElement);
  }

  // 6. If document’s active view transition is transition, set document’s active view transition to null.
  if (isDocumentActive) {
    documentActiveViewTransition = null;
  }
};

export {
  startViewTransition,
  getActiveViewTransition,
  skipTheViewTransition,
  setDocumentMocked,
};

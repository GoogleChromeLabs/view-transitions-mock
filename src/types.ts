/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Document {
    activeViewTransition: ViewTransition | null;
    startViewTransition(
      callbackOptions?:
        | ViewTransitionUpdateCallback
        | StartViewTransitionOptions,
    ): ViewTransition;
  }
}

interface ViewTransition {
  readonly finished: Promise<void>;
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  readonly types: ViewTransitionTypeSet;
  skipTransition(): void;
}

type ViewTransitionUpdateCallback = () => void | Promise<void>;

interface StartViewTransitionOptions {
  update: ViewTransitionUpdateCallback | null;
  types?: string[] | null;
}

interface ViewTransitionTypeSet extends Set<string> {}

// @ref https://drafts.csswg.org/css-view-transitions-1/#viewtransition-phase
type ViewTransitionPhase =
  | "pending-capture"
  | "update-callback-called"
  | "animating"
  | "done";

const possibleViewTransitionPhases: ViewTransitionPhase[] = [
  "pending-capture",
  "update-callback-called",
  "animating",
  "done",
];

export {
  ViewTransition,
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
  ViewTransitionTypeSet,
  ViewTransitionPhase,
  possibleViewTransitionPhases,
};

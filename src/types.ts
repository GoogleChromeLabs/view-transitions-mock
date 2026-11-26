/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Document {
    readonly activeViewTransition: ViewTransition | null;
    startViewTransition(
      callbackOptions?:
        | ViewTransitionUpdateCallback
        | StartViewTransitionOptions,
    ): ViewTransition;
  }

  interface Element {
    readonly activeViewTransition: ViewTransition | null;
    startViewTransition(
      callbackOptions?:
        | ViewTransitionUpdateCallback
        | StartViewTransitionOptions,
    ): ViewTransition;
  }

  interface ViewTransition {
    readonly transitionRoot: Element | null;
  }
}

interface ViewTransition {
  readonly finished: Promise<void>;
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  readonly types: ViewTransitionTypeSet;
  readonly transitionRoot: Element | null;
  skipTransition(): void;
}

type ViewTransitionUpdateCallback = () => any;

interface StartViewTransitionOptions {
  update?: ViewTransitionUpdateCallback | null;
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

type RegistrationTrigger = {
  requireTypes?: boolean;
  requireScoped?: boolean;
  forced?: boolean;
};

export { possibleViewTransitionPhases };
export type {
  ViewTransition,
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
  ViewTransitionTypeSet,
  ViewTransitionPhase,
  RegistrationTrigger,
};

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

export {
  ViewTransition,
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
  ViewTransitionTypeSet,
};

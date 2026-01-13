import {
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
} from "./types";
import { ViewTransition } from "./classes/ViewTransition";

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

  // Make sure there is a callback
  if (!callback) {
    callback = () => {};
  }

  // If there already is a ViewTransition active, skip that first
  if (document.activeViewTransition) {
    document.activeViewTransition.skipTransition();
    document.activeViewTransition = null;
  }

  // Create the (Mocked) View Transition
  const transition = new ViewTransition(callback);
  types.forEach((t) => transition.types.add(t));

  // Store it as the document.activeViewTransition
  document.activeViewTransition = transition;

  // Return it
  return transition;
};

export { startViewTransition };

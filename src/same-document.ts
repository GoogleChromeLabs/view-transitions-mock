import {
  ViewTransitionUpdateCallback,
  StartViewTransitionOptions,
} from "./types";
import {
  ViewTransition,
  setAllowClassCreation,
} from "./classes/ViewTransition";

let activeViewTransition: ViewTransition | null = null;

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
  if (activeViewTransition) {
    activeViewTransition.skipTransition();
    activeViewTransition = null;
  }

  // Create the (Mocked) View Transition
  setAllowClassCreation(true);
  const transition = new ViewTransition(callback);
  setAllowClassCreation(false);
  types.forEach((t) => transition.types.add(t));

  // Store it as the activeViewTransition
  activeViewTransition = transition;
  transition.finished.then(() => {
    activeViewTransition = null;
  });

  // Return it
  return transition;
};

const getActiveViewTranstion = (): ViewTransition | null => {
  return activeViewTransition;
};

export { startViewTransition, getActiveViewTranstion };

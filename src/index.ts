import { startViewTransition } from "./same-document";

import { ViewTransition } from "./classes/ViewTransition";
import { ViewTransitionTypeSet } from "./classes/ViewTransitionTypeSet";

const register = (force: boolean = false): void => {
  if (!document.startViewTransition || force) {
    if (!window.ViewTransition) {
      Reflect.defineProperty(window, "ViewTransition", {
        value: ViewTransition,
      });
    }

    if (!window.ViewTransitionTypeSet) {
      Reflect.defineProperty(window, "ViewTransitionTypeSet", {
        value: ViewTransitionTypeSet,
      });
    }

    document.startViewTransition = startViewTransition;
  }
};

export { register };

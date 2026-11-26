/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  startViewTransition,
  getActiveViewTransition,
  setDocumentMocked,
} from "./same-document.js";

import { ViewTransition } from "./classes/ViewTransition.js";
import { ViewTransitionTypeSet } from "./classes/ViewTransitionTypeSet.js";
import type { RegistrationTrigger } from "./types.js";

let registered = false;
let registeredDocument = false;
let registeredScoped = false;
let polyfilledNativeTransitionRoot = false;
let polyfilledNativeTypeSet = false;

// Store native implementations if they exist
const nativeImplementations = {
  ViewTransition: window.ViewTransition,
  ViewTransitionDescriptor: Reflect.getOwnPropertyDescriptor(
    window,
    "ViewTransition",
  ),
  ViewTransitionTypeSet: (window as any).ViewTransitionTypeSet,
  ViewTransitionTypeSetDescriptor: Reflect.getOwnPropertyDescriptor(
    window,
    "ViewTransitionTypeSet",
  ),
  startViewTransition: document.startViewTransition,
  documentOwnStartViewTransition: Reflect.getOwnPropertyDescriptor(
    document,
    "startViewTransition",
  ),
  documentOwnActiveViewTransition: Reflect.getOwnPropertyDescriptor(
    document,
    "activeViewTransition",
  ),
  elementStartViewTransition: Reflect.getOwnPropertyDescriptor(
    Element.prototype,
    "startViewTransition",
  ),
  elementActiveViewTransition: Reflect.getOwnPropertyDescriptor(
    Element.prototype,
    "activeViewTransition",
  ),
  viewTransitionTransitionRoot: window.ViewTransition
    ? Reflect.getOwnPropertyDescriptor(
        window.ViewTransition.prototype,
        "transitionRoot",
      )
    : undefined,
};

const defaultRegistrationTrigger = {
  requireTypes: true,
  requireScoped: true,
  forced: false,
};

const register = (
  registrationTrigger: RegistrationTrigger = defaultRegistrationTrigger,
): void => {
  if (registered) return;

  const requireTypesSupport = registrationTrigger.requireTypes ?? true;
  const requireScopedSupport = registrationTrigger.requireScoped ?? true;
  const forceRegister = registrationTrigger.forced ?? false;

  const hasSameDocumentViewTransitionsSupport =
    !!nativeImplementations.startViewTransition;
  const hasViewTransitionTypesSupport =
    hasSameDocumentViewTransitionsSupport &&
    !!nativeImplementations.ViewTransition &&
    "types" in nativeImplementations.ViewTransition.prototype;
  const hasScopedViewTransitionsSupport =
    !!nativeImplementations.elementStartViewTransition;

  const needsDocumentRegistration =
    !hasSameDocumentViewTransitionsSupport ||
    (hasSameDocumentViewTransitionsSupport &&
      !hasViewTransitionTypesSupport &&
      requireTypesSupport) ||
    forceRegister;

  const needsScopedRegistration =
    (!hasScopedViewTransitionsSupport && requireScopedSupport) || forceRegister;

  if (!needsDocumentRegistration && !needsScopedRegistration) {
    return;
  }

  if (needsDocumentRegistration) {
    Object.setPrototypeOf(ViewTransition.prototype, Object.prototype);
    Object.setPrototypeOf(ViewTransitionTypeSet.prototype, Set.prototype);

    Reflect.defineProperty(window, "ViewTransition", {
      value: ViewTransition,
      configurable: true,
      writable: true,
    });

    Reflect.defineProperty(window, "ViewTransitionTypeSet", {
      value: ViewTransitionTypeSet,
      configurable: true,
      writable: true,
    });

    Reflect.defineProperty(document, "activeViewTransition", {
      get: getActiveViewTransition,
      configurable: true,
    });

    Reflect.defineProperty(document, "startViewTransition", {
      value: startViewTransition.bind(document),
      configurable: true,
      writable: true,
    });

    setDocumentMocked(true);
    registeredDocument = true;
  }

  if (needsScopedRegistration) {
    // In granular mode (native Document VT kept intact, only Element-Scoped VT mocked),
    // chain our mock prototypes onto the native prototypes so instanceof checks pass
    // for both native document transitions and mocked element-scoped transitions.
    if (!needsDocumentRegistration) {
      if (nativeImplementations.ViewTransition) {
        Object.setPrototypeOf(
          ViewTransition.prototype,
          nativeImplementations.ViewTransition.prototype,
        );

        if (!nativeImplementations.viewTransitionTransitionRoot) {
          Reflect.defineProperty(
            nativeImplementations.ViewTransition.prototype,
            "transitionRoot",
            {
              get: () => document.documentElement,
              configurable: true,
            },
          );
          polyfilledNativeTransitionRoot = true;
        }
      }

      if (nativeImplementations.ViewTransitionTypeSet) {
        Object.setPrototypeOf(
          ViewTransitionTypeSet.prototype,
          nativeImplementations.ViewTransitionTypeSet.prototype,
        );
      } else {
        Object.setPrototypeOf(ViewTransitionTypeSet.prototype, Set.prototype);
        Reflect.defineProperty(window, "ViewTransitionTypeSet", {
          value: ViewTransitionTypeSet,
          configurable: true,
          writable: true,
        });
        polyfilledNativeTypeSet = true;
      }
    }

    Reflect.defineProperty(Element.prototype, "activeViewTransition", {
      get: getActiveViewTransition,
      configurable: true,
    });

    Reflect.defineProperty(Element.prototype, "startViewTransition", {
      value: startViewTransition,
      configurable: true,
      writable: true,
    });

    registeredScoped = true;
  }

  registered = true;

  if (registeredDocument) {
    console.info("Support for Same-Document View Transitions is now mocked");
  } else if (registeredScoped) {
    console.info("Support for Element-Scoped View Transitions is now mocked");
  }
};

const unregister = (): void => {
  if (!registered) return;

  const wasDocumentMocked = registeredDocument;
  const wasScopedMocked = registeredScoped;

  if (registeredDocument) {
    if (nativeImplementations.ViewTransitionDescriptor) {
      Reflect.defineProperty(
        window,
        "ViewTransition",
        nativeImplementations.ViewTransitionDescriptor,
      );
    } else {
      Reflect.deleteProperty(window, "ViewTransition");
    }

    if (nativeImplementations.ViewTransitionTypeSetDescriptor) {
      Reflect.defineProperty(
        window,
        "ViewTransitionTypeSet",
        nativeImplementations.ViewTransitionTypeSetDescriptor,
      );
    } else {
      Reflect.deleteProperty(window, "ViewTransitionTypeSet");
    }

    if (nativeImplementations.documentOwnActiveViewTransition) {
      Reflect.defineProperty(
        document,
        "activeViewTransition",
        nativeImplementations.documentOwnActiveViewTransition,
      );
    } else {
      Reflect.deleteProperty(document, "activeViewTransition");
    }

    if (nativeImplementations.documentOwnStartViewTransition) {
      Reflect.defineProperty(
        document,
        "startViewTransition",
        nativeImplementations.documentOwnStartViewTransition,
      );
    } else {
      Reflect.deleteProperty(document, "startViewTransition");
    }

    setDocumentMocked(false);
    registeredDocument = false;
  }

  if (registeredScoped) {
    if (nativeImplementations.elementActiveViewTransition) {
      Reflect.defineProperty(
        Element.prototype,
        "activeViewTransition",
        nativeImplementations.elementActiveViewTransition,
      );
    } else {
      Reflect.deleteProperty(Element.prototype, "activeViewTransition");
    }

    if (nativeImplementations.elementStartViewTransition) {
      Reflect.defineProperty(
        Element.prototype,
        "startViewTransition",
        nativeImplementations.elementStartViewTransition,
      );
    } else {
      Reflect.deleteProperty(Element.prototype, "startViewTransition");
    }

    if (
      polyfilledNativeTransitionRoot &&
      nativeImplementations.ViewTransition
    ) {
      Reflect.deleteProperty(
        nativeImplementations.ViewTransition.prototype,
        "transitionRoot",
      );
      polyfilledNativeTransitionRoot = false;
    }

    if (polyfilledNativeTypeSet) {
      Reflect.deleteProperty(window, "ViewTransitionTypeSet");
      polyfilledNativeTypeSet = false;
    }

    Object.setPrototypeOf(ViewTransition.prototype, Object.prototype);
    Object.setPrototypeOf(ViewTransitionTypeSet.prototype, Set.prototype);

    registeredScoped = false;
  }

  registered = false;

  if (wasDocumentMocked) {
    console.info(
      "Support for Same-Document View Transitions is no longer mocked",
    );
  } else if (wasScopedMocked) {
    console.info(
      "Support for Element-Scoped View Transitions is no longer mocked",
    );
  }
};

export { register, unregister };
export type { RegistrationTrigger };

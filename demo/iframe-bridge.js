/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { register, unregister } from "./view-transitions-mock.js";

const origin = window.location.origin;

// Snapshot native APIs before any registration
const nativeAPIs = {
  docStartVT: document.startViewTransition,
  viewTransition: window.ViewTransition,
  hasTypes:
    typeof document.startViewTransition === "function" &&
    typeof window.ViewTransition === "function" &&
    "types" in window.ViewTransition.prototype,
  elementStartVT: Element.prototype.startViewTransition,
};

let activePreset = null;
let transitionCounter = 0;

const formatTime = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

const formatArg = (arg) => {
  if (arg instanceof Error || arg instanceof DOMException) {
    return `${arg.name}: ${arg.message}`;
  }
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
};

const postToParent = (payload) => {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, origin);
  }
};

export const postLog = ({
  kind = "log",
  badge = "log",
  message = "",
  meta = "",
}) => {
  postToParent({
    type: "vtm-log",
    entry: {
      kind,
      badge,
      message,
      meta: meta ? `${meta} · ${formatTime()}` : formatTime(),
    },
  });
};

export const getSupportStates = () => {
  const docSupported = typeof document.startViewTransition === "function";
  const docState = !docSupported
    ? "unsupported"
    : nativeAPIs.docStartVT &&
        document.startViewTransition === nativeAPIs.docStartVT
      ? "native"
      : "mocked";

  const typesSupported =
    docSupported &&
    typeof window.ViewTransition === "function" &&
    "types" in window.ViewTransition.prototype;
  const typesState = !typesSupported
    ? "unsupported"
    : nativeAPIs.hasTypes && window.ViewTransition === nativeAPIs.viewTransition
      ? "native"
      : "mocked";

  const scopedSupported =
    typeof Element.prototype.startViewTransition === "function";
  const scopedState = !scopedSupported
    ? "unsupported"
    : nativeAPIs.elementStartVT &&
        Element.prototype.startViewTransition === nativeAPIs.elementStartVT
      ? "native"
      : "mocked";

  return { docState, typesState, scopedState };
};

const postStatus = () => {
  postToParent({
    type: "vtm-status",
    states: getSupportStates(),
    activePreset,
  });
};

// Intercept console.* inside the iframe so view-transitions-mock messages appear in the sidebar
const hookConsole = () => {
  const hooks = [
    ["log", "log", "log"],
    ["info", "info", "mock"],
    ["warn", "warn", "warn"],
    ["error", "error", "error"],
  ];

  for (const [method, kind, badge] of hooks) {
    const orig = console[method].bind(console);
    console[method] = (...args) => {
      orig(...args);
      postLog({
        kind,
        badge,
        message: args.map(formatArg).join(" "),
      });
    };
  }
};

const describeRoot = (el) => {
  if (!el) return "null";
  const tag = el.tagName ? el.tagName.toLowerCase() : String(el);
  return el.id ? `<${tag}#${el.id}>` : `<${tag}>`;
};

export const runViewTransition = ({
  target,
  targetLabel,
  isScoped = false,
  types = [],
  update,
  skipImmediately = false,
}) => {
  const id = ++transitionCounter;
  const start = performance.now();
  const elapsed = () => `+${(performance.now() - start).toFixed(1)}ms`;
  const states = getSupportStates();
  const mode = isScoped ? states.scopedState : states.docState;

  let transition;
  try {
    transition = target.startViewTransition({
      update: () => {
        postLog({
          kind: "callback",
          badge: `#${id} callback`,
          meta: elapsed(),
          message: `updateCallback executed on ${targetLabel}`,
        });
        update();
      },
      types,
    });
  } catch (err) {
    const hint = isScoped
      ? "\n→ Click register() in the sidebar to mock Element-Scoped View Transitions."
      : "\n→ Click register() in the sidebar to mock Same-Document View Transitions.";
    postLog({
      kind: "error",
      badge: `#${id} error`,
      message: `${err.name}: ${err.message}${hint}`,
    });
    return;
  }

  const activeTypes = transition.types ? Array.from(transition.types) : [];
  const rootDesc =
    "transitionRoot" in transition
      ? describeRoot(transition.transitionRoot)
      : "n/a";

  postLog({
    kind: "start",
    badge: `#${id} start`,
    meta: mode,
    message: `${targetLabel}.startViewTransition()\nroot: ${rootDesc} · types: [${activeTypes.join(", ")}]`,
  });

  transition.updateCallbackDone
    .then(() => {
      postLog({
        kind: "promise",
        badge: `#${id} ucd`,
        meta: elapsed(),
        message: "updateCallbackDone resolved",
      });
    })
    .catch((err) => {
      postLog({
        kind: "error",
        badge: `#${id} ucd`,
        meta: elapsed(),
        message: `updateCallbackDone rejected (${err?.name ?? err})`,
      });
    });

  transition.ready
    .then(() => {
      postLog({
        kind: "promise",
        badge: `#${id} ready`,
        meta: elapsed(),
        message: "ready resolved",
      });
    })
    .catch((err) => {
      postLog({
        kind: "warn",
        badge: `#${id} skip`,
        meta: elapsed(),
        message: `ready rejected (${err?.name ?? "Error"}: ${err?.message ?? err})`,
      });
    });

  transition.finished
    .then(() => {
      postLog({
        kind: "promise",
        badge: `#${id} done`,
        meta: elapsed(),
        message: "finished resolved",
      });
    })
    .catch((err) => {
      postLog({
        kind: "error",
        badge: `#${id} done`,
        meta: elapsed(),
        message: `finished rejected (${err?.name ?? err})`,
      });
    });

  if (skipImmediately) {
    transition.skipTransition();
  }
};

export const initBridge = (welcomeMessage) => {
  hookConsole();

  // Apply saved theme immediately
  const savedTheme = localStorage.getItem("theme") || "system";
  document.documentElement.setAttribute("data-theme", savedTheme);

  let welcomed = false;
  const sendWelcomeOnce = () => {
    if (welcomed || !welcomeMessage) return;
    welcomed = true;
    postLog({ kind: "info", badge: "info", message: welcomeMessage });
  };

  window.addEventListener("message", (event) => {
    if (event.origin !== origin || event.source !== window.parent) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "vtm-sync") {
      postStatus();
      sendWelcomeOnce();
      return;
    }

    if (data.type === "vtm-theme" && typeof data.theme === "string") {
      document.documentElement.setAttribute("data-theme", data.theme);
      return;
    }

    if (data.type === "vtm-control") {
      if (data.action === "unregister") {
        unregister();
        activePreset = null;
        postStatus();
        return;
      }

      if (data.action === "register") {
        const current = getSupportStates();
        const currentlyMocked =
          current.docState === "mocked" ||
          current.typesState === "mocked" ||
          current.scopedState === "mocked";

        if (currentlyMocked && activePreset && activePreset !== data.preset) {
          unregister();
        }

        const before = getSupportStates();
        if (data.options) {
          register(data.options);
        } else {
          register();
        }
        const after = getSupportStates();

        const changed =
          before.docState !== after.docState ||
          before.typesState !== after.typesState ||
          before.scopedState !== after.scopedState;

        if (changed) {
          activePreset = data.preset;
        } else if (!currentlyMocked) {
          postLog({
            kind: "log",
            badge: "noop",
            message:
              "Native browser already satisfies all required features. Try register({ forced: true }) to force the mock.",
          });
        }

        postStatus();
      }
    }
  });

  postStatus();
};

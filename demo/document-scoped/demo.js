/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  initBridge,
  getSupportStates,
  runViewTransition,
} from "../iframe-bridge.js";

const gridEl = document.getElementById("doc-grid");

const shuffleChildren = (container) => {
  const items = Array.from(container.children);
  if (items.length < 2) return;

  const original = items.slice();
  let attempts = 0;
  do {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    attempts++;
  } while (attempts < 5 && items.every((item, idx) => item === original[idx]));

  for (const item of items) {
    container.appendChild(item);
  }
};

document.getElementById("btn-shuffle")?.addEventListener("click", () => {
  runViewTransition({
    target: document,
    targetLabel: "document",
    isScoped: false,
    types: ["shuffle"],
    update: () => shuffleChildren(gridEl),
  });
});

document.getElementById("btn-layout")?.addEventListener("click", () => {
  runViewTransition({
    target: document,
    targetLabel: "document",
    isScoped: false,
    types: ["layout-change"],
    update: () => {
      gridEl.classList.toggle("is-compact");
    },
  });
});

document.getElementById("btn-skip")?.addEventListener("click", () => {
  runViewTransition({
    target: document,
    targetLabel: "document",
    isScoped: false,
    types: ["skipped"],
    skipImmediately: true,
    update: () => shuffleChildren(gridEl),
  });
});

const { docState } = getSupportStates();
const welcome =
  docState === "native"
    ? 'Native Document View Transitions are supported here. Click "Shuffle Cards", or click "forced: true" in the sidebar to compare with the non-visual mock.'
    : 'Document View Transitions are not natively supported here. Click "Shuffle Cards" to see the error, then click register() in the sidebar.';

initBridge(welcome);

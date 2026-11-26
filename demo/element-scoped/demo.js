/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  initBridge,
  getSupportStates,
  runViewTransition,
} from "../iframe-bridge.js";

const listEl = document.getElementById("scoped-list");

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
    target: listEl,
    targetLabel: "ul#scoped-list",
    isScoped: true,
    types: ["reorder", "shuffle"],
    update: () => shuffleChildren(listEl),
  });
});

document.getElementById("btn-reverse")?.addEventListener("click", () => {
  runViewTransition({
    target: listEl,
    targetLabel: "ul#scoped-list",
    isScoped: true,
    types: ["reorder", "reverse"],
    update: () => {
      for (const item of Array.from(listEl.children).reverse()) {
        listEl.appendChild(item);
      }
    },
  });
});

listEl?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-move]");
  if (!btn) return;

  const item = btn.closest("li");
  if (!item) return;

  const dir = btn.dataset.move;
  if (dir === "up" && !item.previousElementSibling) return;
  if (dir === "down" && !item.nextElementSibling) return;

  runViewTransition({
    target: listEl,
    targetLabel: "ul#scoped-list",
    isScoped: true,
    types: ["reorder", `move-${dir}`],
    update: () => {
      if (dir === "up" && item.previousElementSibling) {
        listEl.insertBefore(item, item.previousElementSibling);
      } else if (dir === "down" && item.nextElementSibling) {
        listEl.insertBefore(item.nextElementSibling, item);
      }
      btn.focus();
    },
  });
});

const { scopedState } = getSupportStates();
const welcome =
  scopedState === "unsupported"
    ? 'Element-Scoped View Transitions are not natively supported here. Click "Shuffle" to see the error, then click register() in the sidebar.'
    : 'Native Element-Scoped View Transitions are supported here. Open the popover and click "Shuffle", or click "forced: true" to compare with the mock.';

initBridge(welcome);

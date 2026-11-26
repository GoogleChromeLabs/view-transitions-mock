/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

document.addEventListener("DOMContentLoaded", () => {
  const origin = window.location.origin;
  const iframe = document.getElementById("demo-iframe");

  // 1. Theme Switcher (mirrors view-transitions-toolkit)
  const currentTheme = localStorage.getItem("theme") || "system";
  const themeButtons = document.querySelectorAll(".theme-btn");

  const syncIframeTheme = (theme) => {
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "vtm-theme", theme }, origin);
    }
  };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);

    themeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === theme);
    });

    syncIframeTheme(theme);
  };

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      if (mode) applyTheme(mode);
    });
  });

  applyTheme(currentTheme);

  if (!iframe) return;

  // 2. Iframe Navigation Bar Controls
  const btnBack = document.getElementById("nav-back");
  const btnForward = document.getElementById("nav-forward");
  const btnReload = document.getElementById("nav-reload");
  const logContainer = document.getElementById("log");

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = "../";
    });
  }

  if (btnForward) {
    btnForward.disabled = true;
  }

  if (btnReload) {
    btnReload.addEventListener("click", () => {
      if (logContainer) {
        logContainer.replaceChildren();
      }
      iframe.contentWindow?.location.reload();
    });
  }

  const syncIframe = () => {
    const theme = localStorage.getItem("theme") || "system";
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "vtm-theme", theme }, origin);
      iframe.contentWindow.postMessage({ type: "vtm-sync" }, origin);
    }
  };

  iframe.addEventListener("load", syncIframe);
  syncIframe();

  // 3. Sidebar Console Log Rendering
  const appendLog = ({
    kind = "log",
    badge = "log",
    message = "",
    meta = "",
  }) => {
    if (!logContainer) return;

    const li = document.createElement("li");
    li.className = `log-entry log-${kind}`;

    const metaRow = document.createElement("div");
    metaRow.className = "log-meta";

    const tag = document.createElement("span");
    tag.className = "log-tag";
    tag.textContent = badge;

    const time = document.createElement("span");
    time.textContent = meta;

    metaRow.append(tag, time);

    const body = document.createElement("div");
    body.textContent = message;

    li.append(metaRow, body);
    logContainer.appendChild(li);
    logContainer.scrollTop = logContainer.scrollHeight;
  };

  document.getElementById("clear-log")?.addEventListener("click", () => {
    logContainer?.replaceChildren();
  });

  // 4. Support Status & Mock Controls Bridge
  const stateLabels = {
    native: "Native",
    mocked: "Mocked",
    unsupported: "Unsupported",
  };

  const updateStatus = (states, activePreset) => {
    const entries = [
      ["status-doc", states.docState],
      ["status-types", states.typesState],
      ["status-scoped", states.scopedState],
    ];

    for (const [id, state] of entries) {
      const el = document.getElementById(id);
      if (el && state in stateLabels) {
        el.dataset.state = state;
        el.textContent = stateLabels[state];
      }
    }

    const isAnyMocked =
      states.docState === "mocked" ||
      states.typesState === "mocked" ||
      states.scopedState === "mocked";

    document.querySelectorAll(".mock-btn[data-preset]").forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        isAnyMocked && btn.dataset.preset === activePreset,
      );
    });
  };

  const controlButtons = [
    { id: "register-auto", preset: "auto", options: null },
    {
      id: "register-norequiretypes",
      preset: "no-types",
      options: { requireTypes: false },
    },
    {
      id: "register-norequirescoped",
      preset: "no-scoped",
      options: { requireScoped: false },
    },
    { id: "register-forced", preset: "forced", options: { forced: true } },
  ];

  for (const cfg of controlButtons) {
    document.getElementById(cfg.id)?.addEventListener("click", () => {
      iframe.contentWindow?.postMessage(
        {
          type: "vtm-control",
          action: "register",
          preset: cfg.preset,
          options: cfg.options,
        },
        origin,
      );
    });
  }

  document.getElementById("unregister")?.addEventListener("click", () => {
    iframe.contentWindow?.postMessage(
      { type: "vtm-control", action: "unregister" },
      origin,
    );
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== origin || event.source !== iframe.contentWindow) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "vtm-log" && data.entry) {
      appendLog(data.entry);
    } else if (data.type === "vtm-status" && data.states) {
      updateStatus(data.states, data.activePreset ?? null);
    }
  });
});

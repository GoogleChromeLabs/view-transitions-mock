const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(...args);
  const logContainer = document.querySelector("#log");
  if (logContainer) {
    const li = document.createElement("li");
    li.textContent =
      `console.log — ${Date.now()}\n` +
      args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
    logContainer.appendChild(li);
  }
};

const originalConsoleInfo = console.info;
console.info = (...args) => {
  originalConsoleInfo(...args);
  const logContainer = document.querySelector("#log");
  if (logContainer) {
    const li = document.createElement("li");
    li.textContent =
      `console.info — ${Date.now()}\n` +
      "ℹ️ " +
      args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
    logContainer.appendChild(li);
  }
};

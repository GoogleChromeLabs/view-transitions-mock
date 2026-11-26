#!/usr/bin/env node
/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const MAX_RETRIES_PER_REQUEST = 10;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const customBrowsersDir = fs.realpathSync(
  path.resolve(import.meta.dirname, "..", "custom-browsers"),
);
const requestedBin = process.env.PW_COMPAT_REAL_BIN;
if (!requestedBin) {
  console.error("PW_COMPAT_REAL_BIN is required");
  process.exit(1);
}

const realBin = fs.realpathSync(path.resolve(requestedBin));
if (!realBin.startsWith(customBrowsersDir + path.sep)) {
  console.error(
    `PW_COMPAT_REAL_BIN must resolve inside ${customBrowsersDir}, got ${realBin}`,
  );
  process.exit(1);
}

const childEnv = { ...process.env };
delete childEnv.PW_COMPAT_REAL_BIN;

const child = spawn(realBin, process.argv.slice(2), {
  env: childEnv,
  stdio: ["inherit", "inherit", "inherit", "pipe", "pipe"],
});

// Use net.Socket rather than fs.createReadStream/WriteStream so libuv handles
// the stdio pipes asynchronously and does not block process shutdown on exit.
const parentIn = new net.Socket({ fd: 3, readable: true, writable: false });
const parentOut = new net.Socket({ fd: 4, readable: false, writable: true });
const childOut = child.stdio[3];
const childIn = child.stdio[4];

for (const stream of [parentIn, parentOut, childOut, childIn]) {
  stream.on("error", () => {});
}

parentIn.on("end", () => {
  if (!childOut.destroyed) childOut.end();
});
childIn.on("end", () => {
  if (!parentOut.destroyed) parentOut.end();
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

function writeFrame(stream, raw) {
  if (stream.destroyed || stream.writableEnded) return;
  stream.write(raw);
  stream.write("\0");
}

function readFrames(stream, onFrame) {
  let pendingChunks = [];
  stream.on("data", (chunk) => {
    let start = 0;
    let nul = chunk.indexOf(0, start);
    if (nul === -1) {
      pendingChunks.push(chunk);
      return;
    }

    pendingChunks.push(chunk.subarray(0, nul));
    onFrame(Buffer.concat(pendingChunks).toString("utf8"));
    pendingChunks = [];
    start = nul + 1;

    while ((nul = chunk.indexOf(0, start)) !== -1) {
      onFrame(chunk.subarray(start, nul).toString("utf8"));
      start = nul + 1;
    }

    if (start < chunk.length) {
      pendingChunks.push(chunk.subarray(start));
    }
  });
}

function deleteDotPath(obj, dotPath) {
  const parts = dotPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      FORBIDDEN_KEYS.has(part) ||
      current == null ||
      typeof current !== "object"
    ) {
      return false;
    }
    current = current[part];
  }
  const leaf = parts[parts.length - 1];
  if (
    FORBIDDEN_KEYS.has(leaf) ||
    current == null ||
    typeof current !== "object" ||
    !Object.prototype.hasOwnProperty.call(current, leaf)
  ) {
    return false;
  }
  delete current[leaf];
  return true;
}

/** @type {Map<number, { msg: Record<string, any>, retries: number }>} */
const pendingRequests = new Map();

// Forward Playwright -> Browser frames and cache requests for schema fallback retries.
readFrames(parentIn, (raw) => {
  try {
    const msg = JSON.parse(raw);
    if (typeof msg.id === "number" && msg.id > 0) {
      pendingRequests.set(msg.id, { msg, retries: 0 });
    }
  } catch {
    // Forward unparseable frames untouched.
  }
  writeFrame(childOut, raw);
});

// Forward Browser -> Playwright frames, transparently stripping unknown schema fields
// or stubbing unsupported optional settings for older browser builds.
readFrames(childIn, (raw) => {
  try {
    const msg = JSON.parse(raw);

    if (typeof msg.id === "number" && pendingRequests.has(msg.id)) {
      const entry = pendingRequests.get(msg.id);
      if (msg.error) {
        const errMsg = String(msg.error.message || "");

        // Firefox Juggler rejects newer optional params with:
        //   Found property "<root>.a.b" - ... which is not described in this scheme
        const unknownProp = errMsg.match(
          /Found property "<root>\.([^"]+)"[\s\S]*which is not described in this scheme/,
        );
        if (
          unknownProp &&
          entry.retries < MAX_RETRIES_PER_REQUEST &&
          entry.msg.params &&
          deleteDotPath(entry.msg.params, unknownProp[1])
        ) {
          entry.retries += 1;
          writeFrame(childOut, JSON.stringify(entry.msg));
          return;
        }

        // WebKit Inspector rejects newer Page.overrideSetting names with:
        //   Unknown setting: <SettingName>
        if (errMsg.includes("Unknown setting:")) {
          pendingRequests.delete(msg.id);
          const ok = { ...msg, result: {} };
          delete ok.error;
          writeFrame(parentOut, JSON.stringify(ok));
          return;
        }
      }
      pendingRequests.delete(msg.id);
    }

    // WebKit Inspector wraps per-page target errors inside Target.dispatchMessageFromTarget.
    if (
      msg.method === "Target.dispatchMessageFromTarget" &&
      typeof msg.params?.message === "string"
    ) {
      const inner = JSON.parse(msg.params.message);
      if (
        inner.error &&
        String(inner.error.message || "").includes("Unknown setting:")
      ) {
        const ok = {
          ...msg,
          params: {
            ...msg.params,
            message: JSON.stringify({ id: inner.id, result: {} }),
          },
        };
        writeFrame(parentOut, JSON.stringify(ok));
        return;
      }
    }
  } catch {
    // Forward unparseable frames untouched.
  }

  writeFrame(parentOut, raw);
});

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  parentIn.destroy();
  parentOut.destroy();
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

type BrowserPathConfig = Record<string, string>;
type BrowserPathConfigs = Record<string, BrowserPathConfig>;

const browserPaths: BrowserPathConfigs = {
  // Chromium 110.0.5481.38 (bundled with Playwright 1.30, as chromium-1045)
  "chromium-110-nosupport": {
    darwin: './custom-browsers/chromium-1045/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    linux: './custom-browsers/chromium-1045/chrome-linux/chrome',
    win32: './custom-browsers/chromium-1045/chrome-win/chrome.exe',
  },
  // Firefox 142.0.1 (bundled with Playwright 1.56, as firefox-1495)
  "firefox-142-nosupport": {
    darwin: './custom-browsers/firefox-1495/firefox/Nightly.app/Contents/MacOS/firefox',
    linux: './custom-browsers/firefox-1495/firefox/firefox-bin',
    win32: './custom-browsers/firefox-1495/firefox/firefox.exe',
  },
  // Safari 17.4 (bundled with Playwright 1.45, as webkit-2035)
  "webkit-17.4-nosupport": {
    darwin: './custom-browsers/webkit-2035/pw_run.sh',
    linux: './custom-browsers/webkit-2035/pw_run.sh',
    win32: './custom-browsers/webkit-2035/webkit-win64/Playwright.exe',
  },
};

// On macOS 27+, ~/Library/Application Support/Firefox is TCC-protected.
// Playwright's bundled Firefox (< 158) still resolves that directory despite
// `-profile`, causing headless launches to hang at 100% CPU unless the host
// terminal has Full Disk Access (microsoft/playwright#42768).
// Pointing CFFIXED_USER_HOME at a temp directory keeps the lookup outside the
// protected path; needed for firefox-142-nosupport even on newer Playwright.
function getFirefoxLaunchEnv(): Record<string, string> | undefined {
  if (process.platform !== 'darwin') {
    return undefined;
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  if (!env.CFFIXED_USER_HOME) {
    const homeDir = join(tmpdir(), 'view-transitions-mock-pw-firefox-home');
    mkdirSync(homeDir, { recursive: true, mode: 0o700 });
    env.CFFIXED_USER_HOME = homeDir;
  }

  return env;
}

const firefoxLaunchEnv = getFirefoxLaunchEnv();

// Older Playwright-bundled browsers (e.g. Firefox 142 from Playwright 1.56)
// reject newer optional protocol fields sent by newer Playwright versions.
// Wrapping them with compat-browser-proxy.js transparently strips unknown
// schema properties on the fd 3/4 JSON-RPC pipe without touching node_modules.
function getCompatProxyLaunchOptions(
  executablePath: string,
  extraEnv?: Record<string, string>,
): { executablePath: string; env?: Record<string, string> } {
  if (process.platform === 'win32') {
    return {
      executablePath,
      ...(extraEnv && { env: extraEnv }),
    };
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  if (extraEnv) {
    Object.assign(env, extraEnv);
  }
  env.PW_COMPAT_REAL_BIN = executablePath;

  return {
    executablePath: './tests/compat-browser-proxy.js',
    env,
  };
}

export default defineConfig({
  testDir: './tests',
  tsconfig: './tsconfig.json',
  workers: 3,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium-latest',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-latest',
      use: {
        ...devices['Desktop Firefox'],
        ...(firefoxLaunchEnv && {
          launchOptions: {
            env: firefoxLaunchEnv,
          },
        }),
      },
    },
    {
      name: 'webkit-latest',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox-142-nosupport',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: getCompatProxyLaunchOptions(
          browserPaths['firefox-142-nosupport'][process.platform],
          firefoxLaunchEnv,
        ),
      },
    },
    {
      name: 'chromium-110-nosupport',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: browserPaths['chromium-110-nosupport'][process.platform],
        },
      },
    },
    {
      name: 'webkit-17.4-nosupport',
      use: {
        ...devices['Desktop Safari'],
        launchOptions: getCompatProxyLaunchOptions(
          browserPaths['webkit-17.4-nosupport'][process.platform],
        ),
      },
    },
  ],
  webServer: {
    command: 'npx esbuild --serve=7357 --servedir=. --log-level=silent',
    port: 7357,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-latest',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox-142-nosupport',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          executablePath: browserPaths['firefox-142-nosupport'][process.platform],
        },
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
    // // Disabled, because of this error:
    // // “Error: browserContext.newPage: Protocol error (Page.overrideSetting): Unknown setting: FixedBackgroundsPaintRelativeToDocument”
    // {
    //   name: 'webkit-17.4-nosupport',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     launchOptions: {
    //       executablePath: browserPaths['webkit-17.4-nosupport'][process.platform],
    //     },
    //   },
    // },
  ],
  webServer: {
    command: 'npx esbuild --serve=7357 --servedir=. --log-level=silent',
    port: 7357,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
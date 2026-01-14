import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  tsconfig: './tsconfig.json',
  workers: 3,
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npx esbuild --serve=7357 --servedir=. --log-level=silent',
    port: 7357,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.QA_FRONTEND_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './qa/tests',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], baseURL },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:14200',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: 'chrome' } }
  ],
  webServer: [
    {
      command: '..\\waitero-back\\mvnw.cmd -f ..\\waitero-back\\pom.xml test-compile org.codehaus.mojo:exec-maven-plugin:3.5.0:java "-Dexec.mainClass=com.waitero.campaign.CampaignApplication" "-Dexec.classpathScope=test" "-Dexec.args=--spring.profiles.active=test --server.address=127.0.0.1 --server.port=18080 --app.cors.allowed-origin-patterns=http://127.0.0.1:14200 --app.demo.max-sessions-per-ip-hour=20000 --app.demo.max-orders=1000"',
      url: 'http://127.0.0.1:18080/api/legal/config',
      timeout: 180_000,
      reuseExistingServer: false
    },
    {
      command: 'node_modules\\.bin\\ng.cmd serve --configuration e2e --proxy-config proxy.e2e.conf.json --host 127.0.0.1 --port 14200',
      url: 'http://127.0.0.1:14200/demo',
      timeout: 120_000,
      reuseExistingServer: false
    }
  ]
});

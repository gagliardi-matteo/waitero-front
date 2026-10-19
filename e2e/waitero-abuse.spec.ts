import { expect, Page, test } from '@playwright/test';

type Diagnostics = { consoleErrors: string[]; pageErrors: string[]; serverErrors: string[] };

function watch(page: Page): Diagnostics {
  const result: Diagnostics = { consoleErrors: [], pageErrors: [], serverErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') result.consoleErrors.push(message.text() + ' ' + message.location().url);
  });
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 500) result.serverErrors.push(response.status() + ' ' + response.url());
  });
  return result;
}

function expectClean(...diagnostics: Diagnostics[]): void {
  expect(diagnostics.flatMap(item => item.consoleErrors).filter(message => !message.includes('/customer/demo/stream')), 'unexpected console.error').toEqual([]);
  expect(diagnostics.flatMap(item => item.pageErrors), 'uncaught browser errors').toEqual([]);
  expect(diagnostics.flatMap(item => item.serverErrors), 'unexpected HTTP 5xx').toEqual([]);
}

type StatefulAction = 'ADD' | 'REMOVE' | 'CATEGORY' | 'SEARCH' | 'CART' | 'REFRESH' | 'BACK_FORWARD' | 'SECOND_TAB';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

async function assertMenuInvariants(page: Page, diagnostics: Diagnostics): Promise<void> {
  await expect(page.locator('.dish-card').first()).toBeVisible();
  const quantities = await page.locator('.qty-number').allTextContents();
  for (const value of quantities) {
    expect(Number(value.trim()), `negative or invalid quantity rendered: ${value}`).toBeGreaterThanOrEqual(0);
  }
  expectClean(diagnostics);
}

test('customer and restaurant survive rapid actions, refresh, back-forward and multiple tabs', async ({ browser }) => {
  const context = await browser.newContext();
  await context.route('http://localhost:8080/api/**', route => route.continue({
    url: route.request().url().replace('http://localhost:8080', 'http://127.0.0.1:18080')
  }));
  let disconnectedStreams = 0;
  await context.route('**/customer/demo/stream**', route => {
    if (disconnectedStreams++ < 2) return route.abort('connectionreset');
    return route.fallback();
  });
  const hub = await context.newPage();
  const hubDiagnostics = watch(hub);
  await hub.goto('/demo');
  await expect(hub.getByRole('heading', { name: 'Prova WaiterO' })).toBeVisible();

  const customerHref = await hub.locator('a.browser-link').getAttribute('href');
  const dashboardHref = await hub.getByRole('link', { name: 'Apri la dashboard demo' }).getAttribute('href');
  expect(customerHref).toBeTruthy();
  expect(dashboardHref).toBeTruthy();

  const customer = await context.newPage();
  const dashboard = await context.newPage();
  const customerDiagnostics = watch(customer);
  const dashboardDiagnostics = watch(dashboard);
  await Promise.all([customer.goto(customerHref!), dashboard.goto(dashboardHref!)]);
  await expect(customer.locator('.dish-card').first()).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Ordini Attivi' })).toBeVisible();

  const categoryButtons = customer.locator('.category-pill');
  if (await categoryButtons.count() > 1) {
    await categoryButtons.nth(1).click();
    await categoryButtons.first().click();
  }

  const add = customer.locator('.add-button-overlay').first();
  await add.click({ clickCount: 2, delay: 20 });
  await customer.locator('.summary-header').click();
  const confirm = customer.getByRole('button', { name: 'Conferma Ordine' });
  await confirm.click({ clickCount: 2, delay: 10 });
  await expect(customer.locator('.submit-confirmation').first()).toBeVisible();
  await expect(dashboard.locator('.order-row').first()).toBeVisible();

  await customer.reload();
  await expect(customer.locator('.dish-card').first()).toBeVisible();
  await customer.goBack();
  await customer.goForward();
  await expect(customer.locator('.dish-card').first()).toBeVisible();

  const duplicate = await context.newPage();
  const duplicateDiagnostics = watch(duplicate);
  await duplicate.goto(customer.url());
  await expect(duplicate.locator('.dish-card').first()).toBeVisible();
  await duplicate.reload();
  await expect(duplicate.locator('.dish-card').first()).toBeVisible();

  expectClean(hubDiagnostics, customerDiagnostics, dashboardDiagnostics, duplicateDiagnostics);
  await context.close();
});

for (const seed of [137, 911, 20260916]) {
  test(`stateful customer actions preserve invariants (seed ${seed})`, async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Seeded exploration runs once; mobile is covered by the multi-device journey.');
    const sequence: string[] = [];
    const random = seededRandom(seed);
    const actions: StatefulAction[] = ['ADD', 'REMOVE', 'CATEGORY', 'SEARCH', 'CART', 'REFRESH', 'BACK_FORWARD', 'SECOND_TAB'];
    const context = await browser.newContext();
    await context.route('http://localhost:8080/api/**', route => route.continue({
      url: route.request().url().replace('http://localhost:8080', 'http://127.0.0.1:18080')
    }));
    const hub = await context.newPage();
    const hubDiagnostics = watch(hub);
    const customerDiagnostics: Diagnostics[] = [];

    try {
      await hub.goto('/demo');
      const customerHref = await hub.locator('a.browser-link').getAttribute('href');
      expect(customerHref).toBeTruthy();
      let customer = await context.newPage();
      customerDiagnostics.push(watch(customer));
      await customer.goto(customerHref!);
      await assertMenuInvariants(customer, customerDiagnostics.at(-1)!);

      for (let step = 0; step < 20; step++) {
        const action = actions[Math.floor(random() * actions.length)];
        let outcome = 'DONE';
        if (action !== 'CART' && await customer.locator('.order-details:visible').count()) {
          await customer.locator('.summary-header').click();
          sequence.push(`${step + 1}:CLOSE_CART:PREREQUISITE`);
        }
        if (action === 'ADD') {
          const buttons = customer.locator('.add-button-overlay:visible, .dish-add-overlay .round-btn:last-child:visible');
          const count = await buttons.count();
          if (count) await buttons.nth(Math.floor(random() * count)).click(); else outcome = 'NOOP';
        } else if (action === 'REMOVE') {
          const buttons = customer.locator('.dish-add-overlay .round-btn:first-child:visible');
          const count = await buttons.count();
          if (count) await buttons.nth(Math.floor(random() * count)).click(); else outcome = 'NOOP';
        } else if (action === 'CATEGORY') {
          const buttons = customer.locator('.category-pill:visible');
          const count = await buttons.count();
          if (count) await buttons.nth(Math.floor(random() * count)).click(); else outcome = 'NOOP';
        } else if (action === 'SEARCH') {
          const terms = ['', '  pizza  ', "l'acqua", '🍕漢字', 'nessun-risultato'];
          await customer.getByPlaceholder('Cerca un piatto, ingrediente o allergene').fill(terms[Math.floor(random() * terms.length)]);
          if (await customer.locator('.empty-state:visible').count()) {
            await customer.getByPlaceholder('Cerca un piatto, ingrediente o allergene').fill('');
          }
        } else if (action === 'CART') {
          await customer.locator('.summary-header').click();
        } else if (action === 'REFRESH') {
          await customer.reload();
        } else if (action === 'BACK_FORWARD') {
          await customer.goBack();
          await customer.goForward();
        } else {
          const duplicate = await context.newPage();
          const duplicateDiagnostics = watch(duplicate);
          customerDiagnostics.push(duplicateDiagnostics);
          await duplicate.goto(customer.url());
          await assertMenuInvariants(duplicate, duplicateDiagnostics);
          await customer.close();
          customer = duplicate;
        }
        sequence.push(`${step + 1}:${action}:${outcome}`);
        await assertMenuInvariants(customer, customerDiagnostics.at(-1)!);
      }
      expect(sequence.some(entry => entry.endsWith(':DONE')), 'seed produced no executable action').toBe(true);
      expectClean(hubDiagnostics, ...customerDiagnostics);
    } catch (error) {
      await testInfo.attach(`stateful-seed-${seed}.txt`, {
        body: Buffer.from(`seed=${seed}\n${sequence.join('\n')}`),
        contentType: 'text/plain'
      });
      throw error;
    } finally {
      await context.close().catch(() => {});
    }
  });
}
test('timeout after committed submit retries the same demo intent exactly once', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  await context.route('http://localhost:8080/api/**', route => route.continue({
    url: route.request().url().replace('http://localhost:8080', 'http://127.0.0.1:18080')
  }));
  const requestIds: Array<string | undefined> = [];
  let attempts = 0;
  await context.route('**/customer/demo/orders?**', async route => {
    const body = route.request().postDataJSON() as { requestId?: string };
    requestIds.push(body.requestId);
    const response = await route.fetch({
      url: route.request().url().replace('http://localhost:8080', 'http://127.0.0.1:18080')
    });
    attempts++;
    if (attempts === 1) await route.abort('timedout');
    else await route.fulfill({ response });
  });
  const hub = await context.newPage();
  const customer = await context.newPage();
  try {
    await hub.goto('/demo');
    const customerHref = await hub.locator('a.browser-link').getAttribute('href');
    expect(customerHref).toBeTruthy();
    const demoToken = new URL(customerHref!, 'http://127.0.0.1:14200').searchParams.get('s');
    expect(demoToken).toBeTruthy();
    await customer.goto(customerHref!);
    await expect(customer.locator('.dish-card').first()).toBeVisible();
    await customer.locator('.add-button-overlay').first().click();
    await customer.locator('.summary-header').click();
    await customer.getByRole('button', { name: 'Conferma Ordine' }).click();
    await expect(customer.locator('.submit-confirmation.error')).toBeVisible();
    await customer.getByRole('button', { name: 'Conferma Ordine' }).click();
    await expect(customer.locator('.submit-confirmation').first()).toContainText('successo');

    const stateResponse = await context.request.get(`http://127.0.0.1:18080/api/customer/demo/orders/state?token=${encodeURIComponent(demoToken!)}`);
    expect(stateResponse.ok()).toBe(true);
    const state = await stateResponse.json();
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toBeTruthy();
    expect(requestIds[1]).toBe(requestIds[0]);
    expect(state.currentOrder.items.reduce((sum: number, item: { quantita: number }) => sum + item.quantita, 0)).toBe(1);
  } finally {
    await context.close().catch(() => {});
  }
});
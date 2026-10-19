import { BrowserContext, devices, expect, Page, test } from '@playwright/test';

type Tenant = { restaurantId:number; dishId:number; email:string; password:string; publicId:string; qrUrl:string };
const api='http://127.0.0.1:18080/api';

async function enterQr(page:Page,url:string):Promise<void> {
  await page.goto(url);
  await expect(async()=> {
    if(await page.locator('.dish-card').first().isVisible()) return;
    const proceed=page.getByRole('button',{name:'Continua',exact:true}).first();
    if(await proceed.isVisible()) await proceed.click({timeout:2000});
    await expect(page.locator('.dish-card').first()).toBeVisible({timeout:3000});
  }).toPass({timeout:25000});
}

test('real QR customers and owner dashboards keep two restaurants isolated through payment and reordering', async ({ browser, request },testInfo) => {
  test.setTimeout(120_000);
  const fixture=await request.post(`${api}/customer/campaign/fixtures`,{data:{}});
  expect(fixture.ok(), `Fixture HTTP ${fixture.status()}: ${await fixture.text()}`).toBe(true);
  const {tenants}=await fixture.json() as {tenants:Tenant[]};
  const contexts:BrowserContext[]=[];
  const device=devices[testInfo.project.name==='mobile-chrome'?'Pixel 7':'Desktop Chrome'];
  try {
    const journeys=[];
    for(const tenant of tenants) {
      const login=await request.post(`${api}/auth/local-login`,{data:{email:tenant.email,password:tenant.password}});
      expect(login.ok()).toBe(true);
      const tokens=await login.json();
      const legal=await request.post(`${api}/legal/backoffice/accept`,{headers:{Authorization:`Bearer ${tokens.accessToken}`},data:{}});
      expect(legal.ok()).toBe(true);
      const ownerContext=await browser.newContext({...device});contexts.push(ownerContext);
      await ownerContext.addInitScript(({accessToken,refreshToken})=>{localStorage.setItem('accessToken',accessToken);localStorage.setItem('refreshToken',refreshToken);},tokens);
      const owner=await ownerContext.newPage();await owner.goto('/orders');
      owner.on('dialog',dialog=>dialog.accept());
      await expect(owner.getByRole('heading',{name:'Ordini Attivi'})).toBeVisible();
      const customers=[];
      for(let i=0;i<2;i++) {
        const context=await browser.newContext({...device,geolocation:{latitude:45,longitude:9},permissions:['geolocation']});contexts.push(context);
        const page=await context.newPage();await enterQr(page,tenant.qrUrl);
        await expect(page.locator('.dish-card').first()).toBeVisible();
        await expect(page.locator('.dish-card').first()).toContainText(`Piatto browser ${tenant===tenants[0]?'A':'B'}`);
        customers.push(page);
      }
      journeys.push({tenant,owner,customers,tokens});
    }
    // Each table submits its first intention concurrently with the other restaurant.
    await Promise.all(journeys.map(async({customers})=>{
      const customer=customers[0];
      await customer.locator('.add-button-overlay').first().click();
      await customer.locator('.summary-header').click();
      await customer.getByRole('button',{name:'Conferma Ordine'}).click();
      await expect(customer.locator('.submit-confirmation').first()).toContainText('successo');
    }));
    for(const journey of journeys) {
      await expect(journey.owner.locator('body')).toContainText('Tavolo 1');
      const active=await request.get(`${api}/orders/active`,{headers:{Authorization:`Bearer ${journey.tokens.accessToken}`}});
      expect(active.ok()).toBe(true);
      const orders=await active.json();expect(orders).toHaveLength(1);
      expect(orders[0].restaurantId).toBe(journey.tenant.restaurantId);
      const orderId=orders[0].id;
      await journey.owner.goto(`/orders/${orderId}`);
      await journey.owner.getByRole('button',{name:'Segna residuo come saldato'}).click();
      await expect(journey.owner.getByRole('button',{name:'Ordine saldato'})).toBeVisible();
      // Re-scan the same printed QR to establish a fresh device session after payment cleanup.
      await enterQr(journey.customers[1],journey.tenant.qrUrl);
      await expect(journey.customers[1].locator('.dish-card').first()).toBeVisible();
      await journey.customers[1].locator('.add-button-overlay').first().click();
      await journey.customers[1].locator('.summary-header').click();
      await journey.customers[1].getByRole('button',{name:'Conferma Ordine'}).click();
      await expect(journey.customers[1].locator('.submit-confirmation').first()).toContainText('successo');
      const response=await request.get(`${api}/orders/active`,{headers:{Authorization:`Bearer ${journey.tokens.accessToken}`}});
      const renewed=await response.json();expect(renewed).toHaveLength(1);expect(renewed[0].id).not.toBe(orderId);
      expect(renewed[0].items[0].quantita).toBe(1);
    }
  } finally { await Promise.all(contexts.map(c=>c.close())); }
});

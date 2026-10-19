import { APIRequestContext, expect, test as baseTest } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

type Sample = { ok: boolean; latencyMs: number; stages: Record<string, number>; error?: string };
type LevelMetrics = { users: number; elapsedMs: number; throughput: number; errorRate: number; p50: number; p95: number; p99: number };

const api = 'http://127.0.0.1:18080/api';

const test = baseTest.extend<{ campaignTelemetry: void }>({
  campaignTelemetry: [async ({ request }, use, testInfo) => {
    if (!process.env['WAITERO_LOAD']) { await use(); return; }
    const samples: unknown[] = [];
    let inFlight: Promise<void> | null = null;
    const collect = () => {
      if (inFlight) return;
      inFlight = (async () => {
        try {
          const response = await request.get('http://127.0.0.1:18080/api/customer/campaign/metrics', { timeout: 5000 });
          samples.push(response.ok() ? await response.json() : { error: `metrics HTTP ${response.status()}` });
          await response.dispose();
        } catch (error) { samples.push({ error: String(error), time: Date.now() }); }
        mkdirSync('campaign-evidence', { recursive: true });
        writeFileSync(`campaign-evidence/telemetry-${testInfo.project.name}-${testInfo.title.includes('soak') ? 'soak' : 'load'}.json`, JSON.stringify(samples, null, 2));
      })().finally(() => { inFlight = null; });
    };
    collect();
    const interval = setInterval(collect, 1000);
    try { await use(); } finally { clearInterval(interval); if (inFlight) await inFlight; }
  }, { auto: true }]
});

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(percentileValue * sorted.length) - 1)];
}

async function realisticWorkflow(request: APIRequestContext): Promise<Sample> {
  const started = Date.now();
  const stages: Record<string, number> = {};
  async function timed<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try { return await operation(); } finally { stages[name] = Date.now() - start; }
  }
  try {
    const sessionResponse = await timed('session', () => request.post(`${api}/customer/demo/sessions`, { data: {} }));
    if (!sessionResponse.ok()) throw new Error(`session:${sessionResponse.status()}`);
    const session = await sessionResponse.json();
    await sessionResponse.dispose();
    const menuResponse = await timed('menu', () => request.get(`${api}/customer/demo/menu`, { params: { token: session.token } }));
    if (!menuResponse.ok()) throw new Error(`menu:${menuResponse.status()}`);
    const menu = await menuResponse.json();
    await menuResponse.dispose();
    if (!Array.isArray(menu) || !menu.length) throw new Error('menu:empty');
    const submitResponse = await timed('submit', () => request.post(`${api}/customer/demo/orders`, {
      params: { token: session.token },
      data: { requestId: randomUUID(), items: [{ dishId: menu[0].id, quantity: 1 }] }
    }));
    if (!submitResponse.ok()) throw new Error(`submit:${submitResponse.status()}`);
    await submitResponse.dispose();
    const stateResponse = await timed('state', () => request.get(`${api}/customer/demo/orders/state`, { params: { token: session.token } }));
    if (!stateResponse.ok()) throw new Error(`state:${stateResponse.status()}`);
    const state = await stateResponse.json();
    await stateResponse.dispose();
    if (!state.currentOrder || state.currentOrder.items.reduce((sum: number, item: { quantita: number }) => sum + item.quantita, 0) !== 1) {
      throw new Error('state:invariant');
    }
    const dashboardResponse = await timed('dashboard', () => request.get(`${api}/customer/demo/orders/active-summary`, { params: { token: session.token } }));
    if (!dashboardResponse.ok()) throw new Error(`dashboard:${dashboardResponse.status()}`);
    await dashboardResponse.dispose();
    return { ok: true, latencyMs: Date.now() - started, stages };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, stages, error: error instanceof Error ? error.message : String(error) };
  }
}

function metrics(users: number, elapsedMs: number, samples: Sample[]): LevelMetrics {
  const latencies = samples.map(sample => sample.latencyMs);
  return {
    users,
    elapsedMs,
    throughput: Number((samples.length / (elapsedMs / 1000)).toFixed(2)),
    errorRate: Number((samples.filter(sample => !sample.ok).length / samples.length).toFixed(4)),
    p50: percentile(latencies, 0.50),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99)
  };
}

test.describe('local load and soak', () => {
  test.skip(!process.env['WAITERO_LOAD'], 'Run explicitly with WAITERO_LOAD=1; excluded from ordinary functional regression.');

  test('progressive realistic load 1/5/10/25/50/100', async ({ request }, testInfo) => {
    test.setTimeout(10 * 60_000);
    const report: LevelMetrics[] = [];
    const evidence: unknown[] = [];
    mkdirSync('campaign-evidence', { recursive: true });
    for (const users of [1, 5, 10, 25, 50, 100]) {
      const started = Date.now();
      const samples: Sample[] = [];
      for (let wave = 0; wave < Number(process.env['WAITERO_LOAD_WAVES'] ?? 3); wave++) {
        samples.push(...await Promise.all(Array.from({ length: users }, () => realisticWorkflow(request))));
      }
      const level = metrics(users, Date.now() - started, samples);
      report.push(level);
      evidence.push({ ...level, samples: samples.length, stageP95: Object.fromEntries(
        ['session', 'menu', 'submit', 'state', 'dashboard'].map(name => [name, percentile(samples.map(s => s.stages[name] ?? 0), 0.95)])
      ), failures: samples.filter(s => !s.ok) });
      writeFileSync(`campaign-evidence/load-${testInfo.project.name}.json`, JSON.stringify(evidence, null, 2));
      expect(samples.filter(sample => !sample.ok), `failures at ${users} users: ${JSON.stringify(samples.filter(sample => !sample.ok))}`).toEqual([]);
    }
    await testInfo.attach('load-metrics.json', { body: Buffer.from(JSON.stringify(report, null, 2)), contentType: 'application/json' });
    console.log(`WAITERO_LOAD_METRICS ${JSON.stringify(report)}`);
  });

  test('extended mixed-concurrency soak preserves invariants', async ({ request }, testInfo) => {
    const soakMs = Number(process.env['WAITERO_SOAK_MS'] ?? 120_000);
    test.setTimeout(soakMs + 120_000);
    const samples: Sample[] = [];
    const started = Date.now();
    while (Date.now() - started < soakMs) {
      samples.push(...await Promise.all(Array.from({ length: 10 }, () => realisticWorkflow(request))));
    }
    const report = metrics(10, Date.now() - started, samples);
    const failures = samples.filter(sample => !sample.ok);
    mkdirSync('campaign-evidence', { recursive: true });
    writeFileSync(`campaign-evidence/soak-${testInfo.project.name}.json`, JSON.stringify({ ...report, durationTargetMs: soakMs, samples: samples.length, failures }, null, 2));
    await testInfo.attach('soak-metrics.json', { body: Buffer.from(JSON.stringify({ ...report, samples: samples.length, failures }, null, 2)), contentType: 'application/json' });
    console.log(`WAITERO_SOAK_METRICS ${JSON.stringify({ ...report, samples: samples.length })}`);
    expect(failures, `soak failures: ${JSON.stringify(failures.slice(0, 10))}`).toEqual([]);
  });
});

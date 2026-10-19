import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';

test('SSE socket endurance, abrupt disconnect cleanup and reproducible retry chaos',async({},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chrome','Backend socket endurance runs once; real browser mobile is covered separately.');
  test.setTimeout(240_000);
  const result=await promisify(execFile)('node',['../campaign-realtime.mjs'],{timeout:210_000,env:process.env});
  const evidence=JSON.parse(readFileSync('../campaign-evidence/realtime-chaos.json','utf8'));
  expect(evidence.failure).toBeUndefined();
  expect(evidence.scenarios.every((scenario:{passed:boolean})=>scenario.passed)).toBe(true);
  expect(evidence.samples.at(-1).demoEmitters).toBe(0);
  await testInfo.attach('realtime-chaos.json',{body:Buffer.from(JSON.stringify(evidence,null,2)),contentType:'application/json'});
  console.log(result.stdout.trim());
});

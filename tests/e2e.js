import { createRequire } from 'node:module';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { seed } from '../extension/core.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/musi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { server } = await import('../scripts/demo-server.js');
const baseUrl = `http://127.0.0.1:${process.env.DEMO_PORT || 4174}`;
const profile = await mkdtemp(path.join(tmpdir(), 'hospital-rpa-test-'));
let context;
try {
  const extension = path.resolve('extension');
  const browserOptions = { headless: true, reducedMotion: 'reduce', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] };
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) browserOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  else browserOptions.channel = 'chromium';
  context = await chromium.launchPersistentContext(profile, browserOptions);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  let page = await context.newPage(); await page.goto(`${baseUrl}/`); await page.waitForLoadState('networkidle');
  const options = await context.newPage(); await options.goto(`chrome-extension://${id}/workbench.html`);
  const fixture = seed(true);
  fixture.settings.targetOrigins = [baseUrl]; fixture.settings.externalOrigins = [baseUrl];
  for (const template of fixture.templates) {
    template.startUrl = template.startUrl.replace('http://127.0.0.1:4174', baseUrl);
    for (const step of template.steps) if (step.url) step.url = step.url.replace('http://127.0.0.1:4174', baseUrl);
  }
  await options.evaluate(data => chrome.runtime.sendMessage({type:'IMPORT', data}), {version:1, ...fixture});
  await options.reload();
  await options.getByRole('heading', { name: 'COD1', exact: true }).waitFor();
  const errors = []; options.on('pageerror', e => errors.push(e.message)); page.on('pageerror', e => errors.push(e.message));
  const rpc = message => options.evaluate(m => chrome.runtime.sendMessage(m), message);
  const state = async () => (await rpc({ type: 'STATE' })).state;
  assert.equal((await state()).templates.find(t => t.templateId === 'demo-COD').startUrl, `${baseUrl}/search`, '悬浮面板状态应包含模板目标页面');
  let tabId = await options.evaluate(url => chrome.tabs.query({ url: `${url}/*` }).then(tabs => tabs[0].id), baseUrl);
  let lastRunId = null;
  const waitRun = async () => { for (let i = 0; i < 200; i++) { const s = await state(); const run = s.runs[0]; if (run?.id && run.id !== lastRunId && !s.activeRun) { lastRunId = run.id; return run; } await new Promise(r => setTimeout(r, 100)); } throw new Error('run timeout or no new run started'); };
  const cod1Card = options.locator('article').filter({ has: options.getByRole('heading', { name: 'COD1', exact: true }) });
  let reviewDialog;
  options.once('dialog', async dialog => { reviewDialog = dialog.message(); await dialog.dismiss(); });
  await cod1Card.getByRole('button', { name: '运行任务 →' }).click();
  assert.ok(reviewDialog.includes(`任务：COD1`) && reviewDialog.includes('DEMO-1001') && reviewDialog.includes(`目标页面：${baseUrl}`) && reviewDialog.includes('待填内容：'));
  assert.equal((await state()).activeRun, null, '取消运行前核对后不应启动任务');
  await page.close();
  options.once('dialog', dialog => dialog.accept());
  await cod1Card.getByRole('button', { name: '运行任务 →' }).click();
  await options.locator('#notice').filter({ hasText: '没有打开授权的业务页' }).waitFor();
  assert.equal((await state()).activeRun, null, '无授权业务页面时确认后也不应启动任务');
  if (process.env.ONLY_CONFIRMATION_E2E !== '1') {
  page = await context.newPage(); await page.goto(`${baseUrl}/`); await page.waitForLoadState('networkidle');
  tabId = await options.evaluate(url => chrome.tabs.query({ url: `${url}/*` }).then(tabs => tabs[0].id), baseUrl);
  options.once('dialog', dialog => dialog.accept());
  await cod1Card.getByRole('button', { name: '运行任务 →' }).click();
  assert.equal((await waitRun()).status, 'success', '确认运行前核对后应启动任务');
  for (const name of ['COD1', 'COD2', 'A1']) {
    assert.equal((await rpc({ type: 'RUN', instanceId: `demo-${name}`, tabId })).ok, true);
    assert.equal((await waitRun()).status, 'success'); assert.match(await page.locator('#result').innerText(), new RegExp(name));
  }
  assert.equal((await rpc({ type: 'RECORD_START', tabId, name: '实录查询', groupName: 'TEST' })).ok, true);
  await page.locator('#search-word').fill('RECORDED'); await page.locator('#search-button').click();
  await page.locator('#result[data-ready=true]').waitFor();
  assert.equal((await rpc({ type: 'RECORD_STOP' })).ok, true);
  let recorded = (await state()).templates.find(t => t.name === '实录查询');
  assert.ok(recorded.steps.some(s => s.type === 'input' && s.value === 'RECORDED'));
  recorded.steps.find(s => s.type === 'input').value = '{searchWord}';
  recorded.steps.push({ type: 'wait', selector: '#result[data-ready=true]', expectedText: 'REPLAY' });
  assert.equal((await rpc({ type: 'SAVE_TEMPLATE', template: recorded })).ok, true);
  assert.equal((await rpc({ type: 'RUN', templateId: recorded.templateId, vars: {}, tabId })).ok, false);
  assert.equal((await rpc({ type: 'RUN', templateId: recorded.templateId, vars: { searchWord: 'REPLAY' }, tabId })).ok, true);
  assert.equal((await waitRun()).status, 'success'); assert.match(await page.locator('#result').innerText(), /REPLAY/);
  const checkpointTemplate = (await state()).templates.find(t => t.templateId === recorded.templateId);
  await rpc({ type: 'SAVE_TEMPLATE', template: { ...checkpointTemplate, steps: [...checkpointTemplate.steps.slice(0, -1), { ...checkpointTemplate.steps.at(-1), expectedText: 'NEVER-APPEARS', timeout: 200 }] } });
  await rpc({ type: 'RUN', templateId: recorded.templateId, vars: { searchWord: 'REPLAY' }, tabId });
  const failedCheckpoint = await waitRun();
  assert.equal(failedCheckpoint.status, 'failed');
  assert.match(failedCheckpoint.error, /成功标志未出现：NEVER-APPEARS/);
  await rpc({ type: 'SAVE_TEMPLATE', template: { ...checkpointTemplate, steps: [...checkpointTemplate.steps.slice(0, -1), { ...checkpointTemplate.steps.at(-1), expectedText: 'REPLAY', timeout: 200 }] } });
  await rpc({ type: 'RUN', templateId: recorded.templateId, vars: { searchWord: 'REPLAY' }, tabId });
  assert.equal((await waitRun()).status, 'success', '成功标志出现后应判定流程完成');
  await options.reload(); await options.getByRole('button', { name: '▤　流程模板' }).click();
  await options.locator('article').filter({ hasText: '实录查询' }).getByRole('button', { name: '配置变量并生成任务' }).click();
  const variableDialog = options.locator('dialog[open]');
  await variableDialog.locator('textarea').fill('TEST1 | PERSON_A\nTEST2 | PERSON_B');
  await variableDialog.getByRole('button', { name: '保存并生成任务' }).click();
  await variableDialog.waitFor({ state: 'detached' });
  assert.equal((await state()).tasks.filter(t => t.templateId === recorded.templateId).length, 2);
  const personTask = (await state()).tasks.find(t => t.name === 'TEST2');
  assert.equal(personTask.variables.searchWord, 'PERSON_B');
  await rpc({ type: 'RUN', instanceId: personTask.instanceId, tabId });
  assert.equal((await waitRun()).status, 'success');
  assert.match(await page.locator('#result').innerText(), /PERSON_B/);
  assert.equal((await rpc({ type: 'SETTINGS', settings: { targetOrigins: [baseUrl], externalOrigins: [baseUrl], externalEnabled: true } })).ok, true);
  const external = m => page.evaluate(({ id, m }) => chrome.runtime.sendMessage(id, m), { id, m });
  const message = { type: 'RUN', requestId: 'external-e2e-1', templateGroup: 'COD', vars: { searchWord: 'EXTERNAL' } };
  assert.equal((await external(message)).ok, true); assert.equal((await waitRun()).status, 'success');
  assert.equal((await external(message)).duplicate, true);
  const t = (await state()).templates[0];
  await rpc({ type: 'SAVE_TEMPLATE', template: { ...t, templateId: 'stop-test', name: '停止测试', steps: [{ type: 'wait', selector: '#never-present', timeout: 15000 }] } });
  await rpc({ type: 'RUN', templateId: 'stop-test', vars: {}, tabId }); await rpc({ type: 'STOP' }); assert.equal((await waitRun()).status, 'stopped');
  await options.reload(); await options.getByRole('heading', { name: 'COD1', exact: true }).waitFor();
  await mkdir('artifacts', { recursive: true }); await options.screenshot({ path: 'artifacts/workbench.png', fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(process.env.ONLY_CONFIRMATION_E2E === '1'
    ? 'E2E passed: pre-run review fields, cancellation, and confirmed launch rejection when no authorized business page is open.'
    : 'E2E passed: pre-run review, success checkpoint pass/fail, COD/A replay, recording, parameterization UI, external dispatch, stop, persistence, clean console.');
} finally { await context?.close(); await new Promise(resolve => server.close(resolve)); }

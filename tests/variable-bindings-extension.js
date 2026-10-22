import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { seed } from '../extension/core.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><body><label>患者<input id="search-word"></label><label>处理意见<textarea name="plan">已有病历正文</textarea></label></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), 'hospital-bindings-'));
let context;
try {
  const extension = path.resolve('extension');
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.BROWSER_EXECUTABLE || chromium.executablePath(), headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/workbench.html`);
  const rpc = message => options.evaluate(message => chrome.runtime.sendMessage(message), message);
  const initial = seed();
  initial.templates = [{ ...initial.templates[0], startUrl: `${origin}/search`, steps: [
    { type: 'input', selector: '#search-word', value: '{searchWord}' },
    { type: 'input', selector: '#search-word', value: '{searchWord}' },
    { type: 'paste', selector: 'textarea[name=plan]' },
    { type: 'input', selector: 'input[name=id]', value: '{patientId}' },
    { type: 'input', selector: 'input[name=age]', value: '{age}' },
    { type: 'input', selector: 'textarea[name=plan]', value: '录制后失焦残留的旧正文' },
  ], bindings: [{ stepIndex: 0, variable: 'searchWord' }, { stepIndex: 1, variable: 'searchWord' }, { stepIndex: 3, variable: 'patientId' }, { stepIndex: 4, variable: 'age' }] }];
  initial.tasks = [{ ...initial.tasks[0], variables: { searchWord: '虚构患者甲', patientId: 'TEST-01', age: '30', taskText: '本次处理意见：补充复诊记录。' } }];
  assert.equal((await rpc({ type: 'IMPORT', data: { version: 1, ...initial } })).ok, true);
  assert.equal((await rpc({ type: 'STATE' })).capabilities.pasteBindings, true);
  await options.reload();
  await options.locator('[data-view=templates]').click();
  await options.getByRole('button', { name: '配置变量并生成任务' }).click();
  const dialog = options.locator('dialog[open]');
  for (const key of ['patientId', 'age']) {
    const rows = dialog.locator('.mapping-row');
    for (let index = await rows.count() - 1; index >= 0; index--) {
      if (await rows.nth(index).getByLabel('变量名称').inputValue() === key) await rows.nth(index).getByRole('button', { name: '移除' }).click();
    }
  }
  await dialog.locator('.mapping-row').first().getByLabel('变量名称').fill('searchWord1');
  await dialog.locator('.mapping-row').first().getByLabel('变量名称').press('Tab');
  await dialog.getByRole('button', { name: '保存并生成任务' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 10000 });
  const saved = (await rpc({ type: 'STATE' })).state;
  assert.equal(saved.templates[0].bindings.find(binding => binding.stepIndex === 2).variable, 'taskText');
  assert.equal(saved.tasks[0].variables.searchWord1, '虚构患者甲');
  assert.equal(saved.tasks[0].variables.patientId, 'TEST-01');
  assert.equal(saved.tasks[0].variables.age, '30');
  assert.equal(saved.templates[0].bindingsConfigured, true);
  assert.equal(saved.templates[0].bindings.length, 2);
  await options.getByRole('button', { name: '配置变量并生成任务' }).click();
  assert.equal(await options.locator('dialog[open] .mapping-row').count(), 2);
  await options.locator('dialog[open]').getByRole('button', { name: '取消', exact: true }).click();
  assert.equal((await rpc({ type: 'SETTINGS', settings: { targetOrigins: [origin], externalOrigins: [], externalEnabled: false } })).ok, true);
  const target = await context.newPage(); await target.goto(`${origin}/search`);
  const tabId = await options.evaluate(async url => (await chrome.tabs.query({ url }))[0].id, `${origin}/search`);
  const started = await rpc({ type: 'RUN', instanceId: saved.tasks[0].instanceId, tabId });
  assert.equal(started.ok, true);
  let finished;
  for (let attempt = 0; attempt < 100; attempt++) {
    finished = (await rpc({ type: 'STATE' })).state.runs.find(run => run.id === started.runId);
    if (finished?.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(finished.status, 'success', finished.error);
  assert.equal(await target.locator('#search-word').inputValue(), '虚构患者甲');
  assert.equal(await target.locator('textarea[name=plan]').inputValue(), initial.tasks[0].variables.taskText);
  const updatedTask = { ...saved.tasks[0], variables: { searchWord1: '虚构患者乙', taskText: '第二次任务：更新后的处理意见。' } };
  await options.reload();
  await options.locator('[data-view=tasks]').click();
  await options.getByLabel('COD1 searchWord1', { exact: true }).fill(updatedTask.variables.searchWord1);
  await options.getByLabel('COD1任务正文', { exact: true }).fill(updatedTask.variables.taskText);
  await options.getByRole('button', { name: '运行这条任务 →', exact: true }).click();
  await options.getByText('已读取并运行 COD1 当前保存的任务数据', { exact: true }).waitFor();
  for (let attempt = 0; attempt < 100; attempt++) {
    finished = (await rpc({ type: 'STATE' })).state.runs.find(run => run.id !== started.runId);
    if (finished?.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(finished.status, 'success', finished.error);
  assert.equal(await target.locator('#search-word').inputValue(), updatedTask.variables.searchWord1);
  assert.equal(await target.locator('textarea[name=plan]').inputValue(), updatedTask.variables.taskText);
  const legacyTemplate = { ...saved.templates[0], bindingsConfigured: false, bindings: [], steps: [
    { type: 'input', selector: '#search-word', value: '{searchWord1}' },
    { type: 'paste', selector: 'textarea[name=plan]' },
    { type: 'input', selector: 'textarea[name=plan]', value: '录制时旧正文，不应覆盖当前任务' },
  ] };
  assert.equal((await rpc({ type: 'SAVE_TEMPLATE', template: legacyTemplate })).ok, true);
  const legacyRun = await rpc({ type: 'RUN', instanceId: saved.tasks[0].instanceId, tabId });
  assert.equal(legacyRun.ok, true);
  for (let attempt = 0; attempt < 100; attempt++) {
    finished = (await rpc({ type: 'STATE' })).state.runs.find(run => run.id === legacyRun.runId);
    if (finished?.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(finished.status, 'success', finished.error);
  assert.equal(await target.locator('textarea[name=plan]').inputValue(), updatedTask.variables.taskText);
  console.log('真实扩展回归通过：绑定移除后完整数据保留、从模拟任务来源修改查询值和正文直接运行、新值写入目标页面。');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  const relative = path.relative(tmpdir(), profile);
  if (relative.startsWith('hospital-bindings-') && !relative.includes(path.sep)) await rm(profile, { recursive: true, force: true });
}

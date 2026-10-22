import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { seed } from '../extension/core.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = createServer(async (req, res) => {
  const filename = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!/^[\w.-]+$/.test(filename)) { res.writeHead(404).end(); return; }
  try {
    const content = await readFile(new URL(`../extension/${filename}`, import.meta.url));
    res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = seed(true);
  const template = { ...state.templates[0], steps: [
    { type: 'click', selector: 'a:nth-of-type(3)', label: '预约登记' },
    { type: 'input', selector: 'input[name="patientId"]', value: '{patientId}' },
    { type: 'input', selector: 'input[name="patientName"]', value: '{patientName}' },
    { type: 'paste', selector: 'textarea[name="history"]' },
  ], bindings: [{ stepIndex: 1, variable: 'patientId' }, { stepIndex: 2, variable: 'patientName' }, { stepIndex: 3, variable: 'taskText' }] };
  state.templates = [template];
  state.tasks = [state.tasks[0]];
  await page.addInitScript(initial => {
    window.testState = initial;
    window.trials = [];
    window.confirm = () => true;
    window.chrome = {
      tabs: { query: async () => [{ id: 9, url: 'http://127.0.0.1:4174/', title: '演示 HIS' }] },
      runtime: { sendMessage: async message => {
        if (message.type === 'SAVE_TEMPLATE') window.testState.templates = [message.template];
        if (message.type === 'RUN_STEP') window.trials.push(message);
        return { ok: true, state: structuredClone(window.testState), extensionId: 'test', capabilities: { pasteBindings: true, explicitBindings: true } };
      } },
    };
  }, state);
  await page.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
  await page.locator('[data-view=templates]').click();
  await page.getByRole('button', { name: '可视化编辑步骤' }).click();
  const rows = page.locator('.step-row');
  assert.equal(await rows.count(), 4);
  assert.match(await rows.nth(0).innerText(), /点击预约登记/);
  assert.match(await rows.nth(1).innerText(), /填写患者编号/);
  assert.match(await rows.nth(2).innerText(), /填写患者姓名/);
  assert.match(await rows.nth(3).innerText(), /粘贴任务正文/);
  await rows.nth(1).getByRole('button', { name: '下移' }).click();
  let saved = await page.evaluate(() => window.testState.templates[0]);
  assert.equal(saved.steps[1].selector, 'input[name="patientName"]');
  assert.deepEqual(saved.bindings.map(binding => [binding.stepIndex, binding.variable]), [[2, 'patientId'], [1, 'patientName'], [3, 'taskText']]);
  await page.locator('.step-row').nth(0).getByRole('button', { name: '单步试运行' }).click();
  const trial = await page.evaluate(() => window.trials[0]);
  assert.equal(trial.stepIndex, 0);
  assert.equal(trial.instanceId, state.tasks[0].instanceId);
  await page.locator('.step-row').nth(1).getByRole('button', { name: '删除' }).click();
  saved = await page.evaluate(() => window.testState.templates[0]);
  assert.equal(saved.steps.length, 3);
  assert.deepEqual(saved.bindings.map(binding => [binding.stepIndex, binding.variable]), [[1, 'patientName'], [2, 'taskText']]);
  assert.deepEqual(errors, []);
  console.log('步骤编辑器浏览器验证通过：中文描述、重排和删除后绑定同步、单步运行请求。');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

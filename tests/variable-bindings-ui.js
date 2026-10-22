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
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = seed(true);
  state.templates = [{ ...state.templates[0], steps: [
    { type: 'input', selector: '#search-word', value: '{searchWord}' },
    { type: 'input', selector: '#search-word', value: '林' },
    { type: 'paste', selector: 'textarea[name=history]' },
    { type: 'input', selector: 'textarea[name=history]', value: '录制时的历史正文' },
    { type: 'paste', selector: 'textarea[name=examination]' },
    { type: 'input', selector: 'textarea[name=examination]', value: '录制时的检查内容' },
  ], bindings: [] }];
  state.tasks = [state.tasks[0]];
  await page.addInitScript(initial => {
    window.testState = initial;
    window.testCapabilities = { pasteBindings: true, explicitBindings: true };
    window.saveTemplateCount = 0;
    window.chrome = { tabs: { query: async () => [] }, runtime: { sendMessage: async message => {
      if (message.type === 'SAVE_TEMPLATE') { window.testState.templates = [message.template]; window.saveTemplateCount++; }
      if (message.type === 'SAVE_TASK') window.testState.tasks = [message.task];
      return { ok: true, state: structuredClone(window.testState), extensionId: 'test', capabilities: window.testCapabilities };
    } } };
  }, state);
  await page.goto(`http://127.0.0.1:${server.address().port}/workbench.html`);
  const sourceBody = '来源中填写的处理意见：核对资料后复诊。';
  await page.getByLabel('COD1 patientName', { exact: true }).fill('来源患者甲');
  assert.equal(await page.getByLabel('COD1 searchWord', { exact: true }).inputValue(), '来源患者甲');
  await page.getByLabel('COD1 patientId', { exact: true }).fill('SOURCE-01');
  await page.getByLabel('COD1 age', { exact: true }).fill('44');
  await page.getByLabel('COD1任务正文', { exact: true }).fill(sourceBody);
  await page.getByRole('button', { name: '保存模拟任务', exact: true }).click();
  await page.getByText('COD1 模拟任务已保存到插件本地', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('COD1 patientId', { exact: true }).inputValue(), 'SOURCE-01');
  await page.locator('[data-view=templates]').click();
  await page.getByRole('button', { name: '配置变量并生成任务' }).click();
  let dialog = page.locator('dialog[open]');
  assert.equal(await dialog.locator('.mapping-row').count(), 2);
  assert.match(await dialog.locator('.mapping-row').first().innerText(), /第1步/);
  assert.match(await dialog.locator('.mapping-row').last().innerText(), /第3步/);
  assert.equal(await dialog.getByLabel('searchWord', { exact: true }).count(), 1);
  assert.equal(await dialog.getByLabel('searchWord', { exact: true }).inputValue(), '来源患者甲');
  assert.equal(await dialog.getByLabel('searchWord', { exact: true }).isEditable(), false);
  assert.equal(await dialog.getByLabel('patientName', { exact: true }).inputValue(), '来源患者甲');
  assert.equal(await dialog.getByLabel('patientName', { exact: true }).isEditable(), false);
  assert.equal(await dialog.getByLabel('patientId', { exact: true }).inputValue(), 'SOURCE-01');
  assert.equal(await dialog.getByLabel('age', { exact: true }).inputValue(), '44');
  assert.equal(await dialog.getByLabel('taskText 任务正文变量', { exact: true }).inputValue(), sourceBody);
  assert.equal(await dialog.getByLabel('taskText 任务正文变量', { exact: true }).isEditable(), false);
  await dialog.locator('.mapping-row').first().getByLabel('变量名称').fill('searchWord1');
  await dialog.locator('.mapping-row').first().getByLabel('变量名称').press('Tab');
  assert.equal(await dialog.getByLabel('searchWord1', { exact: true }).inputValue(), '来源患者甲');
  await dialog.getByRole('button', { name: '保存并生成任务' }).click();
  await dialog.waitFor({ state: 'detached' });
  const saved = await page.evaluate(() => window.testState);
  assert.equal(saved.templates[0].steps[0].value, '{searchWord1}');
  assert.equal(saved.templates[0].steps[1].disabled, true);
  assert.deepEqual(saved.templates[0].bindings, [{ stepIndex: 0, variable: 'searchWord1' }, { stepIndex: 2, variable: 'taskText' }, { stepIndex: 4, variable: 'taskText' }]);
  assert.equal(saved.templates[0].steps[3].disabled, true);
  assert.equal(saved.templates[0].steps[5].disabled, true);
  assert.equal(saved.templates[0].bindingsConfigured, true);
  assert.equal(saved.tasks[0].variables.searchWord1, '来源患者甲');
  assert.equal(saved.tasks[0].variables.taskText, sourceBody);
  assert.equal(saved.tasks[0].variables.patientId, 'SOURCE-01');
  assert.equal(saved.tasks[0].variables.age, '44');
  await page.getByRole('button', { name: '配置变量并生成任务' }).click();
  dialog = page.locator('dialog[open]');
  assert.equal(await dialog.locator('.mapping-row').count(), 2);
  assert.equal(await dialog.getByLabel('searchWord1', { exact: true }).count(), 1);
  await dialog.getByRole('button', { name: '保存并生成任务' }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '配置变量并生成任务' }).click();
  dialog = page.locator('dialog[open]');
  await dialog.locator('.mapping-row').last().getByRole('button', { name: '移除' }).click();
  await dialog.getByRole('button', { name: '保存并生成任务' }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal((await page.evaluate(() => window.testState)).tasks[0].variables.taskText, sourceBody);
  await page.locator('[data-view=tasks]').click();
  assert.equal(await page.getByLabel('COD1任务正文', { exact: true }).inputValue(), sourceBody);
  assert.equal(await page.getByLabel('COD1 age', { exact: true }).inputValue(), '44');
  await page.locator('[data-view=templates]').click();
  const saveCount = await page.evaluate(() => { window.testCapabilities = {}; return window.saveTemplateCount; });
  await page.getByRole('button', { name: '配置变量并生成任务' }).click();
  dialog = page.locator('dialog[open]');
  await dialog.getByRole('button', { name: '保存并生成任务' }).click();
  await dialog.getByText('插件后台仍是旧版本。', { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => window.saveTemplateCount), saveCount);
  assert.deepEqual(errors, []);
  console.log('浏览器回归通过：共享变量、改名、数据保留、重复保存、旧版后台提示且不写入。');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

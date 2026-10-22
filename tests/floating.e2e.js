import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const extension = path.resolve('extension');
const context = await chromium.launchPersistentContext(await mkdtemp(path.join(tmpdir(), 'hpa-floating-')), {
  headless: false,
  viewport: null,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const { createServer } = await import('node:http');
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>HIS test</title><h1>Business page</h1>'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    let business = await context.newPage(); await business.goto(origin);
    const page = await context.newPage();
    const id = new URL(worker.url()).host;
    await page.goto('chrome-extension://' + id + '/floating.html?tabId=999999999');
    const rpc = m => page.evaluate(message => chrome.runtime.sendMessage(message), m);
    assert.equal((await rpc({type:'SETTINGS', settings:{targetOrigins:[origin],externalOrigins:[],externalEnabled:false}})).ok, true);
    await page.locator('#start').click();
    await page.waitForFunction(() => nativeReady || document.querySelector('#notice').className === 'error');
    assert.equal(await page.evaluate(() => nativeReady), true, await page.locator('#notice').textContent());
    await page.waitForFunction(() => nativeState?.collapsed === true);
    const native = await page.evaluate(() => nativeState);
    assert.equal(native.width, 72); assert.equal(native.height, 72); assert.equal(native.border, 'None');
    assert.equal(native.cornerVisible, false); assert.equal(native.topMost, true);
    assert.equal(native.panelVisible, false); assert.equal(native.ballVisible, true);
    await page.evaluate(() => setCollapsed(false));
    await page.waitForFunction(() => nativeState?.collapsed === false);
    assert.equal(await page.evaluate(() => nativeState.panelVisible), true);
    assert.ok(await page.evaluate(() => !!documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('select[aria-label="业务页面"]').value), 'An obsolete controller tabId must reconnect to the only authorized business page.');
    console.log('Native borderless ball verified:', native);
    const details = () => page.evaluate(() => ({
      open: !!documentPictureInPicture.window && !documentPictureInPicture.window.closed,
      text: documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot?.textContent,
    }));
    assert.equal((await details()).open, true);
    await page.evaluate(() => { documentPictureInPicture.window.document.querySelector('hospital-rpa').dataset.identity = 'original'; });
    await business.reload(); await business.goto(origin + '/other');
    const other = await context.newPage(); await other.goto(origin + '/third'); await other.bringToFront();
    assert.equal(await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').dataset.identity), 'original', 'Business page reload/navigation must not recreate the floating UI.');
    await business.waitForFunction(() => { const host = document.querySelector('hospital-rpa'); return host && getComputedStyle(host).display === 'none'; });
    await other.waitForFunction(() => { const host = document.querySelector('hospital-rpa'); return host && getComputedStyle(host).display === 'none'; });
    await page.evaluate(async () => {
      const { state: s } = await chrome.storage.local.get('state');
      const group = s.templates[0].groupName;
      s.groupRun = { id: 'test-group', groupName: group, taskIds: s.tasks.filter(t => s.templates.find(x => x.templateId === t.templateId)?.groupName === group).map(t => t.instanceId), index: 0, status: 'running' };
      s.activeRun = 'test-run'; s.runs = [{ id: 'test-run', groupRunId: 'test-group', name: 'test', index: 1, total: 10, status: 'running' }];
      await chrome.storage.local.set({ state: s });
    });
    await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.progress-fill'));
    const oldWidth = await page.evaluate(() => {
      const root = documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot;
      root.querySelector('.task').dataset.identity = 'same-task'; return root.querySelector('.progress-fill').style.width;
    });
    await page.evaluate(async () => { const { state } = await chrome.storage.local.get('state'); state.runs[0].index = 5; await chrome.storage.local.set({ state }); });
    await page.waitForFunction(old => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.progress-fill').style.width !== old, oldWidth);
    assert.equal(await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task').dataset.identity), 'same-task', 'Step progress must update without recreating task cards.');
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('[aria-label="收起为悬浮球"]').click());
    await page.waitForFunction(() => nativeState?.collapsed === true);
    assert.equal((await rpc({ type: 'STATE' })).state.activeRun, 'test-run', 'Collapsing must not stop an active task.');
    await business.reload();
    assert.equal(await page.evaluate(() => nativeState.ballVisible && !nativeState.panelVisible), true, 'The native ball must survive business reload.');
    await page.evaluate(() => setCollapsed(false));
    await page.waitForFunction(() => nativeState?.collapsed === false);
    assert.equal(await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task').dataset.identity), 'same-task', 'Expand/collapse must preserve task cards.');
    await page.evaluate(async () => { const { state } = await chrome.storage.local.get('state'); state.activeRun = null; state.groupRun = null; state.runs = []; await chrome.storage.local.set({ state }); });
    await page.waitForFunction(() => !documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task > button:last-child').disabled);
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task > button:last-child').click());
    await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('dialog[open]'));
    const review = await page.evaluate(() => documentPictureInPicture.window.document.querySelector('dialog').textContent);
    assert.ok(review.includes('任务：') && review.includes('患者标识：') && review.includes('目标页面：') && review.includes('待填内容：'));
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('dialog button').click());
    assert.equal((await rpc({ type: 'STATE' })).state.activeRun, null, 'Cancel must not start a task.');
    const staleTarget = await context.newPage(); await staleTarget.goto(origin + '/stale-target');
    await page.waitForFunction(() => picker.options.length === 4);
    await page.evaluate(() => { picker.value = String(availableTabs.find(tab => tab.url.endsWith('/stale-target')).id); picker.dispatchEvent(new Event('change')); });
    await staleTarget.close();
    await page.waitForFunction(() => picker.options.length === 3 && picker.value === '');
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task > button:last-child').click());
    await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.status').dataset.errorCode === 'TARGET_TAB');
    assert.equal((await rpc({ type: 'STATE' })).state.activeRun, null, 'Multiple candidates must require manual selection.');
    await page.evaluate(url => { picker.value = String(availableTabs.find(tab => tab.url === url).id); picker.dispatchEvent(new Event('change')); }, business.url());
    await page.waitForFunction(() => !documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.status').classList.contains('error'));
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task > button:last-child').click());
    await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('dialog[open]'));
    assert.ok((await page.evaluate(() => documentPictureInPicture.window.document.querySelector('dialog').textContent)).includes('实际页面地址：' + business.url()));
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('dialog button').click());
    await other.close(); await business.close();
    await page.waitForFunction(() => picker.options.length === 1 && picker.value === '');
    await page.evaluate(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.task > button:last-child').click());
    await page.waitForFunction(() => documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.status').textContent.includes('未找到已授权'));
    business = await context.newPage(); await business.goto(origin + '/reopened');
    await page.waitForFunction(() => picker.value !== '' && !documentPictureInPicture.window.document.querySelector('hospital-rpa').shadowRoot.querySelector('.status').classList.contains('error'));
    assert.equal((await rpc({ type: 'STATE' })).state.activeRun, null, 'Reconnecting must not execute a task automatically.');
    const pipPage = context.pages().find(p => p !== page && p !== business && p !== other && p.url().includes('floating.html'));
    if (pipPage) console.log('PiP target:', pipPage.url());
    assert.equal(await page.evaluate(() => documentPictureInPicture.window.closed), false);
    await page.evaluate(() => documentPictureInPicture.window.close());
    await business.waitForFunction(() => getComputedStyle(document.querySelector('hospital-rpa')).display === 'block');
    await page.locator('#start').click();
    await business.waitForFunction(() => getComputedStyle(document.querySelector('hospital-rpa')).display === 'none');
    await page.close();
    await business.waitForFunction(() => getComputedStyle(document.querySelector('hospital-rpa')).display === 'block');
    console.log('PASS: native ball lifecycle and progress; stale target reconnects; multiple targets require selection; selection clears old errors; reopened sole page reconnects without execution; confirmation includes actual target URL.');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
} finally { await context.close(); }

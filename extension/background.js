import { ensure, template, task, resolveSteps, importData, seed, httpUrl, text, variables, MAX_STEPS, DEMO_TASK_BODY } from './core.js';

// All mutations use one serialized writer; durable activeRun prevents concurrent runs.
let tail = Promise.resolve();
function exclusive(fn) { const result = tail.then(fn); tail = result.catch(() => {}); return result; }
const get = async () => (await chrome.storage.local.get('state')).state;
const put = async state => chrome.storage.local.set({ state });
const initial = exclusive(async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  let state = await get();
  if (!state) state = seed();
  // This MVP uses the in-plugin mock inbox only; keep real external messaging off.
  if (state.settings) state.settings.externalEnabled = false;
  // Give existing demo tasks a fictional preloaded source document, without
  // overwriting any task text the user has already edited.
  for (const sample of state.tasks.filter(t => /^demo-(COD[123]|A[12])$/.test(t.instanceId))) {
    if (!sample.variables.taskText && !sample.variables.historyText) sample.variables.taskText = DEMO_TASK_BODY;
  }
  // Repair older floating-panel recordings that created a new template ID,
  // leaving the built-in group tasks attached to their empty starter template.
  for (const sample of state.tasks) {
    const linked = state.templates.find(t => t.templateId === sample.templateId);
    if (!linked?.steps.length) {
      const recorded = state.templates.filter(t => t.groupName === linked?.groupName && t.steps.length > 0);
      if (recorded.length === 1) sample.templateId = recorded[0].templateId;
    }
  }
  // Upgrade the original built-in sample task values to the fake HIS patients.
  // Only touch untouched seed values; user-edited task data is preserved.
  if (!state.demoSampleValuesUpgraded) {
    const demoNames = ['COD1', 'COD2', 'COD3', 'A1', 'A2'];
    const oldDemoValues = ['A', 'B', 'C', 'D', 'E'];
    const demoPatients = ['林小禾', '周以宁', '许知远', '沈听澜', '顾明溪'];
    for (let i = 0; i < demoNames.length; i++) {
      const sample = state.tasks.find(t => t.instanceId === `demo-${demoNames[i]}`);
      if (sample?.variables?.searchWord === oldDemoValues[i]) sample.variables.searchWord = demoPatients[i];
    }
    state.demoSampleValuesUpgraded = true;
  }
  // An interrupted worker never silently retries a possibly committed HIS action.
  if (state.activeRun) {
    const run = state.runs.find(r => r.id === state.activeRun);
    if (run) { run.status = 'interrupted'; run.error = '后台重启，执行结果需人工核对后重新发起'; run.finishedAt = Date.now(); }
    state.activeRun = null;
  }
  await put(state);
});
chrome.runtime.onInstalled.addListener(() => initial.catch(console.error));
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.alarms.create('watchdog', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => exclusive(async () => {
  const state = await get();
  const run = state?.runs.find(r => r.id === state.activeRun);
  if (run && Date.now() - run.updatedAt > 90000) { run.status = 'interrupted'; run.error = '执行超时，请核对页面结果'; state.activeRun = null; await put(state); }
}));
chrome.tabs.onRemoved.addListener(tabId => exclusive(async () => {
  await initial; const state = await get();
  if (state.recording?.tabId === tabId) { state.recording.error = '录制页面已关闭；可在工作台保存已捕获步骤'; await put(state); }
}));

function allowed(state, url) { return state.settings.targetOrigins.includes(httpUrl(url).origin); }
async function selectedTab(id) {
  if (Number.isInteger(id)) return chrome.tabs.get(id);
  return (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
}
async function beginRun(state, request, tabId) {
  if (request.requestId) {
    text(request.requestId, 'requestId');
    const previous = state.runs.find(r => r.requestId === request.requestId);
    if (previous) return { runId: previous.id, duplicate: true };
  }
  ensure(!state.activeRun && !state.recording, '已有任务或录制正在进行');
  let t, vars, name;
  if (request.instanceId) {
    const instance = state.tasks.find(x => x.instanceId === request.instanceId);
    ensure(instance, '任务不存在'); t = state.templates.find(x => x.templateId === instance.templateId); name = instance.name; vars = { ...instance.variables, taskName: name };
  } else {
    const matches = state.templates.filter(x => request.templateId ? x.templateId === request.templateId : x.groupName === request.templateGroup);
    ensure(matches.length === 1, '分组需要唯一模板；存在多个模板时请指定templateId');
    t = matches[0]; vars = request.vars ?? {}; name = t.name;
  }
  vars = variables(vars);
  if (!request.instanceId && vars.taskName) name = text(vars.taskName, '任务名称');
  const steps = resolveSteps(t, vars); // Fail before any webpage side effects.
  const tab = await selectedTab(tabId);
  ensure(tab?.id && allowed(state, tab.url), '请在已授权的业务网页发起任务');
  ensure(new URL(tab.url).origin === new URL(t.startUrl).origin, '当前页面与模板起始页不同源');
  const run = { id: crypto.randomUUID(), requestId: request.requestId ?? null, templateId: t.templateId, name, tabId: tab.id, status: 'running', index: 0, total: steps.length, startedAt: Date.now(), updatedAt: Date.now() };
  await chrome.storage.session.remove('runtimeClipboard');
  state.runs.unshift(run); state.runs = state.runs.slice(0, 100); state.activeRun = run.id;
  await put(state);
  void execute(run.id, tab.id, t.startUrl, steps, vars);
  return { runId: run.id };
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitPage(tabId) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      try { const reply = await chrome.tabs.sendMessage(tabId, { type: 'PING' }, { frameId: 0 }); if (reply?.ok) return; } catch { /* content script not yet injected */ }
    }
    await delay(150);
  }
  throw new Error('页面加载超时');
}
async function verifyRun(id, tabId, origin) {
  const state = await get(); ensure(state.activeRun === id, '执行已停止');
  const tab = await chrome.tabs.get(tabId);
  ensure(allowed(state, tab.url) && new URL(tab.url).origin === origin, '页面已离开模板授权来源，执行终止');
}
async function execute(id, tabId, startUrl, steps, vars) {
  try {
    await waitPage(tabId);
    await verifyRun(id, tabId, new URL(startUrl).origin);
    if ((await chrome.tabs.get(tabId)).url !== startUrl) { await chrome.tabs.update(tabId, { url: startUrl }); await waitPage(tabId); }
    for (let i = 0; i < steps.length; i++) {
      await waitPage(tabId);
      await verifyRun(id, tabId, new URL(startUrl).origin);
      await exclusive(async () => { const s = await get(); ensure(s.activeRun === id, '执行已停止'); const r = s.runs.find(r => r.id === id); r.index = i; r.updatedAt = Date.now(); await put(s); });
      const step = steps[i];
      if (step.type === 'navigate') {
        if ((await chrome.tabs.get(tabId)).url !== step.url) await chrome.tabs.update(tabId, { url: step.url });
        await waitPage(tabId);
      } else {
        // Do not retry an action after uncertain delivery: clicks may submit clinical data.
        let executableStep = step;
        if (step.type === 'paste') {
          let taskText = vars.taskText || vars.historyText;
          if (!taskText) taskText = (await chrome.storage.session.get('runtimeClipboard')).runtimeClipboard;
          ensure(typeof taskText === 'string' && taskText.length > 0, '任务正文为空；请在插件任务配置中填写正文，或先执行录制流程中的复制操作');
          executableStep = { ...step, clipboardText: taskText };
        }
        const result = await chrome.tabs.sendMessage(tabId, { type: 'PLAY_STEP', step: executableStep, runId: id }, { frameId: 0 });
        ensure(result?.ok, result?.error ?? '页面执行失败');
        await delay(100); // Allow click-triggered navigation to start, not an element-load wait.
      }
    }
    await finish(id, 'success');
  } catch (error) { await finish(id, 'failed', error.message); }
}
async function finish(id, status, error) {
  await chrome.storage.session.remove('runtimeClipboard');
  await exclusive(async () => { const s = await get(); const r = s.runs.find(r => r.id === id); if (!r || s.activeRun !== id) return; Object.assign(r, { status, error, finishedAt: Date.now(), index: status === 'success' ? r.total : r.index }); s.activeRun = null; await put(s); });
}
async function route(m, sender, external = false) {
  await initial;
  ensure(m && typeof m === 'object' && JSON.stringify(m).length <= 2_000_000, '消息过大或无效');
  return exclusive(async () => {
    const s = await get();
    if (external) {
      ensure(s.settings.externalEnabled && s.settings.externalOrigins.includes(httpUrl(sender.url).origin), '外部来源未获授权');
      ensure(sender.frameId === 0 && sender.tab?.id, '仅允许顶层业务网页调用');
      ensure(['RUN', 'RUN_STATUS'].includes(m.type), '不支持的外部指令');
      if (m.type === 'RUN_STATUS') { const r = s.runs.find(x => x.id === m.runId && x.sourceOrigin === httpUrl(sender.url).origin); ensure(r, '执行记录不存在'); return { run: { id: r.id, status: r.status, index: r.index, total: r.total } }; }
      text(m.requestId, 'requestId');
      ensure(!m.instanceId, '外部任务需指定模板及变量');
      const matches = s.templates.filter(t => m.templateId ? t.templateId === m.templateId : t.groupName === m.templateGroup);
      ensure(matches.length === 1, '外部任务需指定唯一模板或分组');
      const targetOrigin = new URL(matches[0].startUrl).origin;
      const targetTabs = (await chrome.tabs.query({})).filter(tab => {
        try { return allowed(s, tab.url) && new URL(tab.url).origin === targetOrigin; } catch { return false; }
      });
      ensure(targetTabs.length === 1, targetTabs.length ? '发现多个匹配的 HIS 标签页，请只保留一个目标页后重试' : '没有找到已授权且与模板匹配的 HIS 标签页，请先打开目标系统并授权其来源');
      const result = await beginRun(s, m, targetTabs[0].id);
      const fresh = await get(); const r = fresh.runs.find(r => r.id === result.runId);
      ensure(!r.sourceOrigin || r.sourceOrigin === httpUrl(sender.url).origin, 'requestId已被其他来源使用');
      r.sourceOrigin = httpUrl(sender.url).origin; await put(fresh); return result;
    }
    ensure(sender.id === chrome.runtime.id, '非法消息来源');
    const page = sender.url?.startsWith(chrome.runtime.getURL('')) === true;
    const content = !page && sender.tab && sender.frameId === 0;
    ensure(page || content, '不支持的调用上下文');
    if (m.type === 'READY') {
      if (s.recording?.tabId === sender.tab?.id && s.recording.lastUrl !== sender.url) {
        const rec = s.recording; ensure(new URL(sender.url).origin === new URL(rec.startUrl).origin, '录制已离开起始来源');
        if (rec.steps.length < MAX_STEPS && !rec.steps.at(-1)?.followNavigation) rec.steps.push({ type: 'navigate', url: sender.url }); rec.lastUrl = sender.url; await put(s);
      }
      return { recording: s.recording?.tabId === sender.tab?.id };
    }
    if (m.type === 'STATE') {
      if (page) return { state: s, extensionId: chrome.runtime.id };
      return { state: { templates: s.templates.map(t => ({ templateId: t.templateId, name: t.name, groupName: t.groupName })), tasks: s.tasks.map(({ variables, ...t }) => ({ ...t, variables: { searchWord: variables.searchWord || '', taskText: variables.taskText || variables.historyText || '' } })), recording: s.recording ? { tabId: s.recording.tabId, name: s.recording.name, count: s.recording.steps.length } : null, activeRun: s.activeRun, runs: s.runs.slice(0, 5).map(({ error, ...r }) => r) } };
    }
    if (m.type === 'CAPTURE_CLIPBOARD') {
      ensure(content && allowed(sender.url) && typeof m.text === 'string' && m.text.length <= 4000, '复制内容无效或页面未授权');
      await chrome.storage.session.set({ runtimeClipboard: m.text }); return {};
    }
    if (m.type === 'OPEN') return chrome.runtime.openOptionsPage();
    if (m.type === 'RUN') return beginRun(s, m, content ? sender.tab.id : m.tabId);
    if (m.type === 'STOP') {
      if (s.activeRun) { const r = s.runs.find(r => r.id === s.activeRun); r.status = 'stopped'; r.finishedAt = Date.now(); s.activeRun = null; await put(s); await chrome.tabs.sendMessage(r.tabId, { type: 'CANCEL' }, { frameId: 0 }).catch(() => {}); }
      return {};
    }
    if (m.type === 'RECORD_START') {
      ensure(!s.recording && !s.activeRun, '已有录制或任务进行中');
      const tab = await selectedTab(content ? sender.tab.id : m.tabId);
      ensure(tab && allowed(s, tab.url), '请先在工作台授权业务网页来源');
      if (m.templateId) ensure(s.templates.some(t => t.templateId === m.templateId && t.groupName === m.groupName), '录制目标模板不存在');
      s.recording = { templateId: m.templateId || null, tabId: tab.id, name: text(m.name, '名称'), groupName: text(m.groupName, '分组'), startUrl: tab.url, lastUrl: tab.url, steps: [] };
      await put(s); await chrome.tabs.sendMessage(tab.id, { type: 'RECORDING', value: true }, { frameId: 0 }); return {};
    }
    if (m.type === 'RECORD_STEP') {
      ensure(content && s.recording?.tabId === sender.tab.id, '未处于录制状态');
      ensure(allowed(s, sender.url) && new URL(sender.url).origin === new URL(s.recording.startUrl).origin, '录制来源未授权');
      const step = template({ ...s.recording, templateId: 'validation', steps: [m.step] }).steps[0];
      const steps = s.recording.steps, last = steps.at(-1);
      if (last && ['input', 'scroll'].includes(step.type) && last.type === step.type && last.selector === step.selector) steps[steps.length - 1] = step;
      else { ensure(steps.length < MAX_STEPS, '已达到500步上限'); steps.push(step); }
      await put(s); return {};
    }
    if (m.type === 'RECORD_STOP') {
      ensure(s.recording, '当前没有录制');
      const rec = s.recording;
      let boundStep = null;
      if (!m.discard) {
        ensure(rec.steps.length > 0, '还没有捕获操作');
        const steps = rec.steps.map(step => ({ ...step }));
        const inputs = steps.map((step, index) => ({ step, index })).filter(x => ['input', 'select'].includes(x.step.type));
        const bind = (entry, variable) => {
          if (!entry || /\{[A-Za-z_]\w*\}/.test(entry.step.value)) return false;
          steps[entry.index].value = `{${variable}}`;
          if (variable === 'searchWord') boundStep = entry.index + 1;
          return true;
        };
        const taskSearch = inputs.find(x => /task[-_ ]?(search|name)|任务/.test(x.step.selector));
        bind(taskSearch, 'taskName');
        const patientSearch = inputs.find(x => /search[-_ ]?word|patient|directory[-_ ]?search|患者/.test(x.step.selector) && x !== taskSearch);
        const firstFree = inputs.find(x => !/\{[A-Za-z_]\w*\}/.test(x.step.value));
        bind(patientSearch || firstFree, 'searchWord');
        const t = template({ ...rec, steps, templateId: rec.templateId || crypto.randomUUID() });
        s.templates = [...s.templates.filter(x => x.templateId !== t.templateId), t];
      }
      s.recording = null; await put(s); await chrome.tabs.sendMessage(rec.tabId, { type: 'RECORDING', value: false }, { frameId: 0 }).catch(() => {}); return { boundVariable: boundStep ? 'searchWord' : null, boundStep };
    }
    ensure(page, '此操作仅允许在扩展工作台执行');
    ensure(!s.activeRun && !s.recording, '请先结束录制或执行');
    if (m.type === 'SAVE_TEMPLATE') { const t = template(m.template); s.templates = [...s.templates.filter(x => x.templateId !== t.templateId), t]; }
    else if (m.type === 'DELETE_TEMPLATE') { s.templates = s.templates.filter(t => t.templateId !== m.id); s.tasks = s.tasks.filter(t => t.templateId !== m.id); }
    else if (m.type === 'SAVE_TASK') { const t = task(m.task, s.templates); s.tasks = [...s.tasks.filter(x => x.instanceId !== t.instanceId), t]; }
    else if (m.type === 'DELETE_TASK') s.tasks = s.tasks.filter(t => t.instanceId !== m.id);
    else if (m.type === 'RESTORE_DEMO_TASKS') {
      const defaults = seed();
      const templateIds = new Set(s.templates.map(t => t.templateId));
      s.templates.push(...defaults.templates.filter(t => !templateIds.has(t.templateId)));
      const taskIds = new Set(s.tasks.map(t => t.instanceId));
      s.tasks.push(...defaults.tasks.filter(t => !taskIds.has(t.instanceId)));
    }
    else if (m.type === 'IMPORT') { Object.assign(s, importData(m.data)); }
    else if (m.type === 'SETTINGS') {
      ensure(Array.isArray(m.settings.targetOrigins) && Array.isArray(m.settings.externalOrigins), '来源配置无效');
      const normalize = list => { ensure(list.length <= 50, '最多配置50个来源'); return [...new Set(list.map(url => httpUrl(url).origin))]; };
      s.settings = { targetOrigins: normalize(m.settings.targetOrigins), externalOrigins: normalize(m.settings.externalOrigins), externalEnabled: m.settings.externalEnabled === true };
    } else throw new Error('未知指令');
    await put(s); return {};
  });
}
const listener = external => (message, sender, respond) => { route(message, sender, external).then(result => respond({ ok: true, ...result })).catch(error => respond({ ok: false, error: error.message })); return true; };
chrome.runtime.onMessage.addListener(listener(false));
chrome.runtime.onMessageExternal.addListener(listener(true));

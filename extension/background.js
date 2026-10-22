import { patientVariableForSelector, ensure, template, task, resolveSteps, resolveSingleStep, importData, seed, httpUrl, text, variables, panelPreferences, MAX_STEPS, DEMO_TASK_BODY, DEMO_TASK_BODIES, LEGACY_DEMO_TASK_BODIES, PREVIOUS_DEMO_TASK_BODIES } from './core.js';

// All mutations use one serialized writer; durable activeRun prevents concurrent runs.
let tail = Promise.resolve();
function exclusive(fn) { const result = tail.then(fn); tail = result.catch(() => {}); return result; }
const get = async () => (await chrome.storage.local.get('state')).state;
const put = async state => chrome.storage.local.set({ state });
const initial = exclusive(async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  let state = await get();
  if (!state) state = seed();
  // Move previously saved mock-HIS workflows to the new local server port.
  if (!state.demoPort4174Migrated) {
    const moveDemoUrl = value => {
      try {
        const url = new URL(value);
        if (url.origin === 'http://127.0.0.1:4173') { url.port = '4174'; return url.href; }
      } catch { /* Keep unrelated or absent URLs as stored. */ }
      return value;
    };
    for (const item of state.templates) {
      item.startUrl = moveDemoUrl(item.startUrl);
      for (const step of item.steps) if (step.type === 'navigate') step.url = moveDemoUrl(step.url);
    }
    state.settings.targetOrigins = [...new Set(state.settings.targetOrigins.map(origin => moveDemoUrl(origin).replace(/\/$/, '')))];
    state.demoPort4174Migrated = true;
  }
  // Add the expanded fictional inbox once for existing installations; keep all
  // tasks the user has edited or removed from that point onward untouched.
  if (!state.demoPatientExpansionAdded) {
    const defaults = seed();
    const taskIds = new Set(state.tasks.map(t => t.instanceId));
    state.tasks.push(...defaults.tasks.filter(t => !taskIds.has(t.instanceId) && Number(t.variables.patientId?.replace('DEMO-', '')) >= 1006));
    state.demoPatientExpansionAdded = true;
  }
  if (!state.demoCodAllPatientsAdded) {
    const codTemplateId = state.tasks.find(item => state.templates.some(t => t.templateId === item.templateId && t.groupName === 'COD'))?.templateId
      || state.templates.find(t => t.groupName === 'COD')?.templateId;
    if (codTemplateId) {
      const taskIds = new Set(state.tasks.map(item => item.instanceId));
      state.tasks.push(...seed().tasks.filter(item => /^COD(?:[7-9]|1[0-2])$/.test(item.name) && !taskIds.has(item.instanceId)).map(item => ({ ...item, templateId: codTemplateId })));
      state.demoCodAllPatientsAdded = true;
    }
  }
  // This MVP uses the in-plugin mock inbox only; keep real external messaging off.
  if (state.settings) state.settings.externalEnabled = false;
  // Give existing demo tasks a fictional preloaded source document, without
  // overwriting any task text the user has already edited.
  const seededTasks = seed().tasks;
  for (const sample of state.tasks.filter(t => /^demo-(COD[1-6]|A[1-6])$/.test(t.instanceId))) {
    const sampleBody = DEMO_TASK_BODIES[sample.name];
    const savedBodies = [sample.variables.taskText, sample.variables.historyText].filter(Boolean);
    const priorDefaults = [DEMO_TASK_BODY, LEGACY_DEMO_TASK_BODIES[sample.name], PREVIOUS_DEMO_TASK_BODIES[sample.name]].filter(Boolean);
    const untouchedExample = (!Object.hasOwn(sample.variables, 'taskText') && !Object.hasOwn(sample.variables, 'historyText')) || (savedBodies.length > 0 && savedBodies.every(body => priorDefaults.includes(body)));
    if (untouchedExample) {
      sample.variables.taskText = sampleBody;
      if (sample.variables.historyText === DEMO_TASK_BODY || sample.variables.historyText === LEGACY_DEMO_TASK_BODIES[sample.name]) delete sample.variables.historyText;
    }
    const defaults = seededTasks.find(t => t.instanceId === sample.instanceId);
    if (defaults) {
      if (!Object.hasOwn(sample.variables, 'patientName')) sample.variables.patientName = sample.variables.searchWord || defaults.variables.patientName;
      if (!Object.hasOwn(sample.variables, 'searchWord')) sample.variables.searchWord = sample.variables.patientName || defaults.variables.searchWord;
      if (!Object.hasOwn(sample.variables, 'patientId')) sample.variables.patientId = defaults.variables.patientId;
      if (!Object.hasOwn(sample.variables, 'age')) sample.variables.age = defaults.variables.age;
    }
  }
  // Align untouched built-in task demographics with the shared HIS directory.
  // User-edited names, ages, or search values are left as entered.
  if (!state.demoTaskPatientsAligned) {
    for (const defaults of seed().tasks) {
      const sample = state.tasks.find(t => t.instanceId === defaults.instanceId);
      if (!sample) continue;
      const vars = sample.variables;
      const defaultVars = defaults.variables;
      const untouchedIdentity = vars.patientName === defaultVars.patientName && vars.searchWord === defaultVars.searchWord && vars.age === defaultVars.age;
      if (!untouchedIdentity) continue;
      if (/^DEMO-2\d{3}$/.test(vars.patientId || '')) vars.patientId = defaultVars.patientId;
      for (const key of ['sex', 'department', 'phone']) if (!Object.hasOwn(vars, key)) vars[key] = defaultVars[key];
    }
    state.demoTaskPatientsAligned = true;
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
    if (state.groupRun?.status === 'running') Object.assign(state.groupRun, { status: 'interrupted', error: '后台重启，未自动继续批量任务', finishedAt: Date.now() });
    state.activeRun = null;
  }
  await put(state);
});
chrome.runtime.onInstalled.addListener(() => initial.catch(console.error));
let openingFloating;
async function openFloating(tabId) {
  if (openingFloating) return openingFloating;
  openingFloating = (async () => {
    const url = chrome.runtime.getURL('floating.html');
    const existing = (await chrome.tabs.query({})).find(tab => tab.url?.split('?')[0] === url);
    if (existing) { await chrome.windows.update(existing.windowId, { focused: true }); await chrome.tabs.update(existing.id, { active: true }); }
    else await chrome.tabs.create({ url: `${url}?tabId=${tabId || ''}`, active: true, pinned: true });
  })();
  try { await openingFloating; } finally { openingFloating = null; }
}
async function floatingVisibility(open, controllerTabId = null) {
  await chrome.storage.session.set({ globalFloatingOpen: open, floatingControllerTabId: controllerTabId });
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'FLOATING_VISIBILITY', open }, { frameId: 0 }).catch(() => {})));
}
chrome.action.onClicked.addListener(tab => openFloating(tab.id).catch(console.error));
chrome.tabs.onRemoved.addListener(async tabId => {
  const session = await chrome.storage.session.get('floatingControllerTabId');
  if (session.floatingControllerTabId === tabId) await floatingVisibility(false);
});
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (!change.url) return;
  const session = await chrome.storage.session.get('floatingControllerTabId');
  if (session.floatingControllerTabId === tabId && change.url.split('?')[0] !== chrome.runtime.getURL('floating.html')) await floatingVisibility(false);
});
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
function taskVariables(task, template) {
  const vars = { ...task.variables };
  const declared = new Set([...(template?.bindings || []).map(binding => binding.variable), ...(template?.steps || []).flatMap(step => !step.disabled && ['input', 'select'].includes(step.type) ? [...String(step.value || '').matchAll(/\{([A-Za-z_]\w*)\}/g)].map(match => match[1]) : [])]);
  if (declared.has('searchWord') && !vars.searchWord && vars.patientName) vars.searchWord = vars.patientName;
  if (declared.has('patientName') && !vars.patientName && vars.searchWord) vars.patientName = vars.searchWord;
  return vars;
}
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
  if (!request.groupRunId) state.groupRun = null;
  let t, vars, name;
  if (request.instanceId) {
    const instance = state.tasks.find(x => x.instanceId === request.instanceId);
    ensure(instance, '任务不存在'); t = state.templates.find(x => x.templateId === instance.templateId); ensure(t, '任务模板不存在'); name = instance.name; vars = { ...taskVariables(instance, t), taskName: name };
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
  const run = { id: crypto.randomUUID(), requestId: request.requestId ?? null, groupRunId: request.groupRunId || null, templateId: t.templateId, name, tabId: tab.id, status: 'running', index: 0, total: steps.length, startedAt: Date.now(), updatedAt: Date.now() };
  await chrome.storage.session.remove('runtimeClipboard');
  state.runs.unshift(run); state.runs = state.runs.slice(0, 100); state.activeRun = run.id;
  await put(state);
  void execute(run.id, tab.id, t.startUrl, steps, vars);
  return { runId: run.id };
}
async function runSingleStep(state, request) {
  ensure(!state.activeRun && !state.recording, '请先结束当前执行或录制');
  ensure(typeof request.templateId === 'string' && Number.isInteger(request.stepIndex), '步骤信息无效');
  const source = state.templates.find(item => item.templateId === request.templateId);
  ensure(source && request.stepIndex >= 0 && request.stepIndex < source.steps.length, '流程步骤不存在');
  const taskInstance = state.tasks.find(item => item.instanceId === request.instanceId && item.templateId === source.templateId);
  ensure(taskInstance, '请选择此流程关联的任务数据');
  const tab = await selectedTab(request.tabId);
  const origin = new URL(source.startUrl).origin;
  ensure(tab?.id && allowed(state, tab.url) && new URL(tab.url).origin === origin, '请打开与流程起始页相同且已授权的业务页面');
  const values = { ...taskVariables(taskInstance, source), taskName: taskInstance.name };
  let step = resolveSingleStep(source, request.stepIndex, values);
  await waitPage(tab.id);
  const readyUrl = (await chrome.tabs.get(tab.id)).url;
  ensure(allowed(state, readyUrl) && new URL(readyUrl).origin === origin, '页面已离开流程授权来源，单步试运行终止');
  if (step.type === 'navigate') {
    ensure(new URL(step.url).origin === origin, '单步试运行仅允许在流程授权来源内跳转');
    await chrome.tabs.update(tab.id, { url: step.url });
    return { message: '已执行页面跳转步骤' };
  }
  if (step.type === 'paste') {
    let taskText = step.clipboardVariable ? values[step.clipboardVariable] : values.taskText || values.historyText;
    if (!taskText) taskText = (await chrome.storage.session.get('runtimeClipboard')).runtimeClipboard;
    ensure(typeof taskText === 'string' && taskText.length > 0, '任务正文为空，请先填写任务正文');
    step = { ...step, clipboardText: taskText };
  }
  const result = await chrome.tabs.sendMessage(tab.id, { type: 'PLAY_STEP', step, runId: `single-step-${crypto.randomUUID()}` }, { frameId: 0 });
  ensure(result?.ok, result?.error || '单步试运行失败');
  return { message: '单步执行成功' };
}
async function beginGroupRun(state, request, tabId) {
  ensure(!state.activeRun && !state.recording, '已有任务或录制正在进行');
  const tasks = state.tasks.filter(task => state.templates.some(t => t.templateId === task.templateId && t.groupName === request.groupName));
  ensure(tasks.length > 0, '这个分组没有任务');
  const tab = await selectedTab(tabId);
  ensure(tab?.id && allowed(state, tab.url), '请在已授权的业务网页发起任务');
  const pageOrigin = new URL(tab.url).origin;
  // Validate the entire group before the first page action, so a missing
  // template or variable cannot leave a half-started batch.
  for (const task of tasks) {
    const template = state.templates.find(t => t.templateId === task.templateId);
    ensure(template?.steps.length, `${task.name} 所属流程尚未录制`);
    ensure(new URL(template.startUrl).origin === pageOrigin, `${task.name} 的流程与当前页面不同源`);
    resolveSteps(template, { ...taskVariables(task, template), taskName: task.name });
    if (template.steps.some(step => step.type === 'paste' && !step.disabled)) ensure((task.variables.taskText || task.variables.historyText || '').length > 0, `${task.name} 缺少任务正文`);
  }
  const id = crypto.randomUUID();
  state.groupRun = { id, groupName: request.groupName, taskIds: tasks.map(task => task.instanceId), index: 0, status: 'running', tabId: tab.id, startedAt: Date.now() };
  try { return await beginRun(state, { instanceId: tasks[0].instanceId, groupRunId: id }, tab.id); }
  catch (error) { state.groupRun = null; throw error; }
}
async function advanceGroup(groupRunId, status, error) {
  await exclusive(async () => {
    const state = await get(); const groupRun = state.groupRun;
    if (!groupRun || groupRun.id !== groupRunId || groupRun.status !== 'running') return;
    if (status !== 'success') {
      Object.assign(groupRun, { status: status === 'stopped' ? 'stopped' : 'failed', error, finishedAt: Date.now() });
      await put(state); return;
    }
    groupRun.index++;
    if (groupRun.index >= groupRun.taskIds.length) {
      Object.assign(groupRun, { status: 'success', finishedAt: Date.now() });
      await put(state); return;
    }
    const nextTask = state.tasks.find(task => task.instanceId === groupRun.taskIds[groupRun.index]);
    await put(state);
    try { await beginRun(state, { instanceId: nextTask.instanceId, groupRunId }, groupRun.tabId); }
    catch (nextError) {
      Object.assign(groupRun, { status: 'failed', error: nextError.message, finishedAt: Date.now() });
      await put(state);
    }
  });
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
          let taskText = step.clipboardVariable ? vars[step.clipboardVariable] : vars.taskText || vars.historyText;
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
  let groupRunId = null;
  await exclusive(async () => { const s = await get(); const r = s.runs.find(r => r.id === id); if (!r || s.activeRun !== id) return; groupRunId = r.groupRunId; Object.assign(r, { status, error, finishedAt: Date.now(), index: status === 'success' ? r.total : r.index }); s.activeRun = null; await put(s); });
  if (groupRunId) await advanceGroup(groupRunId, status, error);
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
      return { recording: s.recording?.tabId === sender.tab?.id, globalFloatingOpen: (await chrome.storage.session.get('globalFloatingOpen')).globalFloatingOpen === true };
    }
    if (m.type === 'OPEN_FLOATING') { ensure(content, '请从业务页面打开悬浮窗'); await openFloating(sender.tab.id); return {}; }
    if (m.type === 'FLOATING_STATUS') {
      ensure(page && sender.url.split('?')[0] === chrome.runtime.getURL('floating.html'), '非法悬浮窗来源');
      await floatingVisibility(m.open === true, m.open === true ? sender.tab?.id : null); return {};
    }
    if (m.type === 'STATE') {
      if (page) return { state: s, extensionId: chrome.runtime.id, capabilities: { pasteBindings: true, explicitBindings: true } };
      const active = s.runs.find(run => run.id === s.activeRun);
      const groupRun = s.groupRun ? {
        id: s.groupRun.id, groupName: s.groupRun.groupName, index: s.groupRun.index,
        total: s.groupRun.taskIds.length, status: s.groupRun.status,
        currentTaskName: s.tasks.find(task => task.instanceId === s.groupRun.taskIds[s.groupRun.index])?.name,
        currentStep: active?.groupRunId === s.groupRun.id ? { index: active.index, total: active.total } : null,
        error: s.groupRun.error,
        tasks: s.groupRun.taskIds.map((instanceId, index) => {
          const task = s.tasks.find(item => item.instanceId === instanceId);
          const taskStatus = index < s.groupRun.index || s.groupRun.status === 'success' ? 'success'
            : index === s.groupRun.index && s.groupRun.status === 'running' ? 'running'
              : index === s.groupRun.index && ['failed', 'stopped'].includes(s.groupRun.status) ? s.groupRun.status : 'pending';
          return { instanceId, name: task?.name || instanceId, status: taskStatus };
        }),
      } : null;
      return { state: { templates: s.templates.map(t => ({ templateId: t.templateId, name: t.name, groupName: t.groupName, startUrl: t.startUrl })), tasks: s.tasks.map(({ variables, ...t }) => ({ ...t, variables: { searchWord: variables.searchWord || '', patientName: variables.patientName || '', patientId: variables.patientId || '', taskText: variables.taskText || variables.historyText || '' } })), recording: s.recording ? { tabId: s.recording.tabId, name: s.recording.name, count: s.recording.steps.length } : null, activeRun: s.activeRun, groupRun, runs: s.runs.slice(0, 5).map(({ error, ...r }) => r) } };
    }
    if (m.type === 'GET_PANEL_PREFS') return { preferences: panelPreferences((await chrome.storage.local.get('panelPreferences')).panelPreferences) };
    if (m.type === 'SET_PANEL_PREFS') {
      const preferences = panelPreferences(m.preferences);
      await chrome.storage.local.set({ panelPreferences: preferences });
      return { preferences };
    }
    if (m.type === 'CAPTURE_CLIPBOARD') {
      ensure(content && allowed(sender.url) && typeof m.text === 'string' && m.text.length <= 4000, '复制内容无效或页面未授权');
      await chrome.storage.session.set({ runtimeClipboard: m.text }); return {};
    }
    if (m.type === 'OPEN') return chrome.runtime.openOptionsPage();
    if (m.type === 'RUN') return beginRun(s, m, content ? sender.tab.id : m.tabId);
    if (m.type === 'RUN_STEP') { ensure(page, '单步试运行仅允许从插件工作台发起'); return runSingleStep(s, m); }
    if (m.type === 'RUN_GROUP') { ensure(content || (page && sender.url.split('?')[0] === chrome.runtime.getURL('floating.html')), '一键分组运行仅允许从流程助手面板发起'); return beginGroupRun(s, m, content ? sender.tab.id : m.tabId); }
    if (m.type === 'STOP') {
      if (s.groupRun?.status === 'running') { Object.assign(s.groupRun, { status: 'stopped', finishedAt: Date.now() }); await put(s); }
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
        for (const entry of inputs) {
          const variable = patientVariableForSelector(entry.step.selector);
          if (variable) bind(entry, variable);
        }
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

const $ = selector => document.querySelector(selector);
let state, view = 'tasks', editing, selectedMockTaskId;
const names = { tasks: '任务工作台', templates: '流程模板', runs: '执行记录', settings: '连接与设置' };
const labels = { running: '执行中', success: '成功', failed: '失败', interrupted: '中断待核对', stopped: '已停止' };
const el = (tag, value, parent, cls) => { const n = document.createElement(tag); if (value !== undefined && value !== null) n.textContent = value; if (cls) n.className = cls; parent?.append(n); return n; };
function notice(message) {
  const box = $('#notice'); box.replaceChildren(); box.hidden = !message;
  if (!message) return;
  el('span', message, box);
  if (/没有打开授权的业务页|未打开授权/.test(message)) {
    const demo = el('button', '打开演示 HIS', box, 'primary'); demo.onclick = () => chrome.tabs.create({ url: 'http://127.0.0.1:4173/' });
    const settings = el('button', '设置真实 HIS 地址', box); settings.onclick = () => { view = 'settings'; render(); };
    el('p', '演示页需要先运行项目目录里的 npm run demo；使用医院系统时，先到“连接与设置”加入 HIS 地址。', box);
  }
}
const send = async m => { const r = await chrome.runtime.sendMessage(m); if (!r?.ok) throw new Error(r?.error || '后台连接失败'); return r; };
function button(parent, label, action, cls) { const n = el('button', label, parent, cls); n.type = 'button'; n.onclick = () => Promise.resolve().then(action).catch(e => notice(e.message)); return n; }
async function refresh() { const r = await send({ type: 'STATE' }); state = r.state; state.extensionId = r.extensionId; render(); }
function edit(kind, value) {
  if (kind === 'SAVE_TASK') return editTask(value);
  editing = kind; $('#editor-title').textContent = kind === 'SAVE_TEMPLATE' ? '编辑流程模板' : '编辑任务实例';
  $('#editor-help').textContent = kind === 'SAVE_TEMPLATE' ? '录制患者查询、打开病历和目标输入框的操作。若录制过一次粘贴（Ctrl+V），运行时会把“模拟下发任务”中对应任务的正文填入该位置。选择器必须唯一。' : '用于插件内模拟任务的本机配置。运行时把患者和正文传给已授权的目标网页；配置不会写入流程模板或执行日志。';
  $('#json-editor').value = JSON.stringify(value, null, 2); $('#editor').showModal();
}
async function targetTab() {
  const tabs = await chrome.tabs.query({});
  const choices = tabs.filter(t => { try { return state.settings.targetOrigins.includes(new URL(t.url).origin); } catch { return false; } });
  if (!choices.length) throw new Error('没有打开授权的业务页。请先启动演示 HIS，或在“连接与设置”授权真实 HIS 地址。');
  if (choices.length === 1) return choices[0].id;
  const selected = $('#target-tab')?.value;
  if (!selected) throw new Error('多个业务页已打开，请先在页面选择框中指定执行页');
  return Number(selected);
}
async function pagePicker(parent) {
  const label = el('label', '执行页面 ', parent); const select = el('select', '', label); select.id = 'target-tab';
  el('option', '选择已授权的业务页面', select).value = '';
  for (const tab of await chrome.tabs.query({})) { try { if (state.settings.targetOrigins.includes(new URL(tab.url).origin)) { const o = el('option', `${tab.title} · ${tab.id}`, select); o.value = tab.id; } } catch { /* browser pages */ } }
}
function render() {
  const parent = $('#view'); parent.replaceChildren();
  $('#crumb').textContent = names[view];
  $('#title').textContent = view === 'tasks' ? '把重复的操作，交给流程。' : names[view];
  $('#subtitle').textContent = { tasks: '录制一次，替换变量，让每一次执行都有迹可循。', templates: '固定步骤与业务变量分离，复用每一个已验证的流程。', runs: '查看本地执行状态。中断或失败后，请先核对业务页面。', settings: '管理允许执行与录制的网页来源。' }[view];
  document.querySelectorAll('nav button').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  if (view === 'tasks') renderTasks(parent);
  if (view === 'templates') renderTemplates(parent);
  if (view === 'runs') renderRuns(parent);
  if (view === 'settings') renderSettings(parent);
}
function renderTasks(parent) {
  const stats = el('div', '', parent, 'stats');
  for (const [label, count, unit] of [['可用任务', state.tasks.length, '个任务'], ['流程模板', state.templates.length, '个模板'], ['近期成功', state.runs.filter(r => r.status === 'success').length, '次执行']]) { const n = el('div', '', stats, 'stat'); el('small', label, n); const num = el('strong', count, n); el('span', unit, num); }
  const bar = el('div', '', parent, 'section-title'); el('h2', '我的任务', bar); const tools = el('div', '', bar, 'toolbar');
  button(tools, '＋ 新建任务', () => { if (!state.templates.length) throw new Error('请先录制模板'); edit('SAVE_TASK', { instanceId: crypto.randomUUID(), templateId: state.templates[0].templateId, name: '新任务', variables: { searchWord: '林小禾' } }); }, 'primary');
  button(tools, '停止执行', () => send({ type: 'STOP' }).then(refresh));
  const picker = el('div', '', parent, 'box');
  el('h2', '先选择要录制或执行的网页', picker);
  el('p', '使用演示时先运行 npm run demo；使用真实医院系统时，先在“连接与设置”填写 HIS 网站来源。', picker);
  pagePicker(picker).catch(e => notice(e.message));
  renderMockInbox(parent);
  if (state.activeRun) el('div', '任务执行中。可在悬浮面板或此处停止；已提交的网页操作不会自动撤销。', parent, 'hint');
  for (const group of [...new Set(state.templates.map(t => t.groupName))]) {
    const head = el('div', '', parent, 'section-title'); const h = el('h2', `${group} 任务组`, head); el('small', 'WORKFLOW GROUP', h);
    const groupTools = el('div', '', head, 'toolbar');
    for (const t of state.templates.filter(t => t.groupName === group)) {
      button(groupTools, t.steps.length ? '重新录制本组流程' : '① 人工录制本组流程', async () => {
        const tabId = await targetTab();
        await send({ type: 'RECORD_START', tabId, templateId: t.templateId, name: t.name, groupName: t.groupName });
        await chrome.tabs.update(tabId, { active: true });
        notice('请在模拟 HIS 中录制患者查询、打开病历、点击目标文本框并粘贴一次示例正文。运行时将使用下方“模拟下发任务”中选定任务的患者和正文；演示页面不会提交病历。');
      });
      button(groupTools, '② 变量高级设置', () => parameterize(t));
    }
    const grid = el('div', '', parent, 'cards');
    for (const task of state.tasks.filter(x => state.templates.find(t => t.templateId === x.templateId)?.groupName === group)) {
      const template = state.templates.find(t => t.templateId === task.templateId);
      const card = el('article', '', grid, 'card'); const top = el('div', '', card, 'card-top'); el('span', '↳', top, 'flow-icon'); el('span', `${template.steps.length} 个步骤`, top, 'chip');
      el('h3', task.name, card); el('p', template.steps.length ? template.name : '尚未录制，请先人工演示本组流程', card); el('p', `患者：${task.variables.searchWord ?? '未配置'}`, card);
      const taskText = task.variables.taskText || task.variables.historyText || '';
      const needsTaskText = template.steps.some(step => step.type === 'paste');
      el('p', `任务正文：${taskText ? `${taskText.slice(0, 90)}${taskText.length > 90 ? '…' : ''}` : needsTaskText ? '尚未配置' : '此流程无需正文'}`, card, 'task-text-preview');
      const actions = el('div', '', card, 'card-actions'); button(actions, '配置', () => edit('SAVE_TASK', task));
      if (taskText) button(actions, '复制正文', async () => { await navigator.clipboard.writeText(taskText); notice(`${task.name} 正文已复制，可手动粘贴；自动回放会直接使用本机任务正文。`); });
      button(actions, '运行任务 →', async () => { const tabId = await targetTab(); await send({ type: 'RUN', instanceId: task.instanceId, tabId }); notice('已开始执行，可在执行记录查看结果'); await refresh(); }, 'primary').disabled = !template.steps.length || (needsTaskText && !taskText.trim()) || !!state.activeRun || !!state.recording;
      button(actions, '删除', async () => { if (confirm(`删除任务 ${task.name}？`)) { await send({ type: 'DELETE_TASK', id: task.instanceId }); await refresh(); } });
    }
    if (!grid.children.length) el('div', '暂无任务，点击“新建任务”绑定此分组模板。', grid, 'empty');
  }
  el('div', '当前为“模拟任务来源”模式：任务名称、患者和正文预置在插件本地，模拟外部系统把任务交给插件；不连接外部服务。正文会在录制的粘贴步骤填入目标位置。演示请只使用虚构信息。', parent, 'hint');
}
function renderMockInbox(parent) {
  const bar = el('div', '', parent, 'section-title');
  const title = el('h2', '模拟下发任务', bar); el('small', 'LOCAL MOCK INBOX', title);
  el('p', '模拟外部业务系统已传入的任务数据；选择任务可查看或修改正文，运行时按患者变量和录制流程执行。', parent, 'hint');
  const tasks = state.tasks;
  if (!tasks.length) {
    const empty = el('div', '', parent, 'empty');
    el('p', '暂无模拟任务。可以恢复内置示例：COD1、COD2、COD3、A1、A2，包含虚构患者和示例正文。', empty);
    button(empty, '恢复示例任务', async () => { await send({ type: 'RESTORE_DEMO_TASKS' }); selectedMockTaskId = 'demo-COD1'; await refresh(); notice('已恢复 COD1–COD3、A1–A2 示例任务；未覆盖任何自定义数据。'); }, 'primary');
    return;
  }
  let selected = tasks.find(task => task.instanceId === selectedMockTaskId) || tasks[0];
  selectedMockTaskId = selected.instanceId;
  const template = state.templates.find(item => item.templateId === selected.templateId);
  const layout = el('div', '', parent, 'mock-inbox');
  const list = el('div', '', layout, 'mock-inbox-list');
  el('div', '待处理任务', list, 'mock-list-label');
  for (const task of tasks) {
    const item = el('button', '', list, `mock-task${task.instanceId === selected.instanceId ? ' active' : ''}`);
    el('strong', task.name, item); el('span', `患者：${task.variables.searchWord || '未配置'}`, item);
    item.onclick = () => { selectedMockTaskId = task.instanceId; render(); };
  }
  const editor = el('div', '', layout, 'mock-document');
  const head = el('div', '', editor, 'mock-document-head');
  const heading = el('div', '', head); el('small', '模拟来源正文 · 草稿', heading); el('h3', `${selected.name}访视记录`, heading);
  const chip = el('span', '本机模拟数据', head, 'chip');
  const patient = el('div', '', editor, 'mock-patient'); el('span', '受试者 / 患者', patient); el('strong', selected.variables.searchWord || '未配置', patient);
  const bodyLabel = el('label', '任务正文（模拟外部传入）', editor);
  const body = el('textarea', '', bodyLabel, 'mock-body'); body.value = selected.variables.taskText || selected.variables.historyText || ''; body.maxLength = 4000; body.setAttribute('aria-label', `${selected.name}任务正文`);
  const actions = el('div', '', editor, 'mock-actions');
  button(actions, '保存模拟任务', async () => {
    const value = body.value.trim(); if (!value) throw new Error('模拟任务正文不能为空');
    await send({ type: 'SAVE_TASK', task: { ...selected, variables: { ...selected.variables, taskText: value } } });
    notice(`${selected.name} 模拟任务已保存到插件本地`); await refresh();
  }, 'primary');
  button(actions, '复制正文', async () => { await navigator.clipboard.writeText(body.value); notice(`${selected.name} 的模拟正文已复制`); });
  const needsPaste = template?.steps.some(step => step.type === 'paste');
  button(actions, needsPaste ? '运行这条任务 →' : '先录制粘贴步骤', async () => {
    if (!needsPaste) throw new Error('先为对应流程录制一次：打开目标病历 → 点击正文框 → 粘贴示例正文，然后保存模板');
    const tabId = await targetTab();
    await send({ type: 'RUN', instanceId: selected.instanceId, tabId });
    notice(`已模拟收到 ${selected.name}：将查找 ${selected.variables.searchWord} 并填入这段正文`); await refresh();
  }, 'primary').disabled = !!state.activeRun || !!state.recording;
  el('p', '此处只是插件内的模拟任务收件箱。运行不会自动保存病历；演示 HIS 只用于练习和核对。', editor, 'mock-footnote');
}
function renderTemplates(parent) {
  const bar = el('div', '', parent, 'section-title'); el('h2', '模板库', bar); const tools = el('div', '', bar, 'toolbar');
  button(tools, '导出备份', () => {
    const data = { version: 1, templates: state.templates, tasks: state.tasks };
    const a = el('a'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.href = url; a.download = 'hospital-rpa-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  button(tools, '导入备份', () => $('#import-file').click());
  button(tools, '＋ 空白模板', () => edit('SAVE_TEMPLATE', { templateId: crypto.randomUUID(), name: '新模板', groupName: 'COD', startUrl: 'http://127.0.0.1:4173/', steps: [{ type: 'input', selector: '#search-word', value: '{searchWord}', timeout: 15000 }] }), 'primary');
  if (state.recording) { const box = el('div', '', parent, 'box'); el('h2', `正在录制：${state.recording.name} · ${state.recording.steps.length} 步`, box); button(box, '保存录制', async () => { const saved = await send({ type: 'RECORD_STOP' }); await refresh(); notice(saved.boundVariable ? `录制已保存；第 ${saved.boundStep} 个文本输入已自动绑定为搜索变量。现在为各个任务填写搜索值即可。` : '录制已保存；未检测到文本输入，请检查是否录到了搜索步骤。'); }); button(box, '丢弃录制', () => send({ type: 'RECORD_STOP', discard: true }).then(refresh)); }
  const grid = el('div', '', parent, 'cards');
  for (const t of state.templates) {
    const card = el('article', '', grid, 'card'); el('span', t.groupName, card, 'chip'); el('h3', t.name, card); el('p', `${t.steps.length} 个步骤 · ${new URL(t.startUrl).host}`, card); el('p', `模板 ID：${t.templateId}`, card);
    button(card, '配置变量并生成任务', () => parameterize(t), 'primary');
    const actions = el('div', '', card, 'card-actions'); button(actions, '高级编辑步骤', () => edit('SAVE_TEMPLATE', t)); button(actions, '删除', async () => { if (confirm(`删除模板“${t.name}”及关联任务？可从事先导出的备份恢复。`)) { await send({ type: 'DELETE_TEMPLATE', id: t.templateId }); await refresh(); } });
  }
  el('div', '录制时在目标正文框粘贴一次示例，即可记录“把任务正文填入此处”的位置。测试运行可从“模拟下发任务”选择预置正文；各任务内容保存在插件本地。', parent, 'hint');
}
function removeRedundantNavigation(steps) {
  const normalized = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === 'click' && steps[i + 1]?.type === 'navigate') {
      normalized.push({ ...step, followNavigation: true });
      i++; // The click itself performs this page transition; replay it against the current result, not its recorded URL.
    } else normalized.push(step);
  }
  return normalized;
}
function editTask(task) {
  const dialog = el('dialog', '', document.body), form = el('form', '', dialog, 'box');
  const linkedTemplate = state.templates.find(t => t.templateId === task.templateId);
  const needsTaskText = linkedTemplate?.steps.some(step => step.type === 'paste') === true;
  const requiredVars = [...new Set((JSON.stringify(linkedTemplate?.steps || []).match(/\{([A-Za-z_]\w*)\}/g) || []).map(x => x.slice(1, -1)))];
  const taskVars = { ...Object.fromEntries(requiredVars.map(key => [key, key === 'taskName' ? task.name : key === 'searchWord' ? '林小禾' : ''])), ...task.variables, ...(requiredVars.includes('taskName') ? { taskName: task.name } : {}), ...(needsTaskText ? { taskText: task.variables.taskText || task.variables.historyText || '' } : {}) };
  el('h2', '任务配置', form); el('p', '这是插件内置的模拟任务数据，保存在当前浏览器；任务工作台的“模拟下发任务”可以直接查看和编辑正文。运行时不会连接真实外部系统。演示请只用虚构数据。', form);
  el('label', '任务名称', form); const name = el('input', '', form); name.required = true; name.value = task.name;
  el('label', '所属流程', form); const select = el('select', '', form);
  for (const t of state.templates) { const option = el('option', `${t.groupName} · ${t.name}`, select); option.value = t.templateId; }
  select.value = task.templateId;
  const inputs = {};
  for (const [key, value] of Object.entries(taskVars)) {
    el('label', key === 'taskName' ? '任务来源（自动匹配任务名称）' : key === 'searchWord' ? '患者姓名或编号' : ['taskText', 'historyText'].includes(key) ? '任务正文（回放时粘贴）' : key, form);
    const input = el(['taskText', 'historyText'].includes(key) || /(?:text|note|history|content|病史|内容|记录)/i.test(key) ? 'textarea' : 'input', '', form); input.value = value; input.required = key !== 'taskName'; if (['taskText', 'historyText'].includes(key)) input.maxLength = 4000; if (key === 'taskName') input.readOnly = true; inputs[key] = input;
  }
  if (inputs.taskName) name.addEventListener('input', () => { inputs.taskName.value = name.value; });
  const status = el('p', '', form); const save = el('button', '保存任务', form, 'primary'); save.type = 'submit';
  button(form, '取消', () => dialog.close()); dialog.onclose = () => dialog.remove();
  form.onsubmit = async e => { e.preventDefault(); try {
    await send({ type: 'SAVE_TASK', task: { ...task, name: name.value, templateId: select.value, variables: Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, key === 'taskName' ? name.value : input.value])) } });
    dialog.close(); await refresh();
  } catch (error) { status.textContent = error.message; } };
  dialog.showModal();
}
function parameterize(t) {
  // Older recordings stored both the result click and the resulting fixed URL.
  // Drop that redundant URL so a replay can follow the newly selected result.
  const source = { ...t, steps: removeRedundantNavigation(t.steps) };
  const needsTaskText = source.steps.some(step => step.type === 'paste');
  const dialog = el('dialog', '', document.body), form = el('form', '', dialog, 'box');
  el('h2', `${source.name} · 任务数据配置`, form);
  el('p', '此处为每个任务分别配置患者姓名/编号和正文。正文只保存在插件本地；运行时由扩展传入已录制的粘贴位置。录制流程只需在 HIS 中完成患者查询、打开病历和一次 Ctrl+V。旧录制里点击结果后跳到固定病历地址的冗余跳转会自动清理。', form);
  const pasteTargets = new Set(source.steps.filter(step => step.type === 'paste').map(step => step.selector));
  const candidates = source.steps.map((step, index) => ({ step, index })).filter(x => ['input', 'select'].includes(x.step.type) && !pasteTargets.has(x.step.selector));
  const mappings = el('div', '', form, 'mapping-list');
  let taskRows, taskRowStates = [];
  const addMapping = (stepIndex, variableName) => {
    const row = el('div', '', mappings, 'mapping-row');
    const stepSelect = el('select', '', row); stepSelect.required = true;
    for (const { step, index } of candidates) { const option = el('option', `第${index + 1}步 · ${step.selector} · ${String(step.value).slice(0, 50)}`, stepSelect); option.value = index; }
    if (stepIndex != null) stepSelect.value = String(stepIndex);
    const variable = el('input', '', row); variable.placeholder = '变量名，例如 historyText'; variable.value = variableName || ''; variable.required = true; variable.pattern = '[A-Za-z_][A-Za-z0-9_]{0,63}'; variable.setAttribute('aria-label', '变量名称');
    variable.addEventListener('change', rebuildTaskRows);
    button(row, '移除', () => row.remove());
    return { row, stepSelect, variable };
  };
  const bound = candidates.flatMap(({ step, index }) => [...String(step.value || '').matchAll(/\{([A-Za-z_]\w*)\}/g)].map(match => ({ index, key: match[1] })));
  const mappingsState = [];
  if (bound.length) bound.forEach(x => mappingsState.push(addMapping(x.index, x.key)));
  else if (candidates.length) mappingsState.push(addMapping(candidates[0].index, 'searchWord'));
  button(form, '＋ 添加一个可变化的输入', () => { if (!candidates.length) return; mappingsState.push(addMapping(candidates[0].index, `variable${mappingsState.length + 1}`)); rebuildTaskRows(); });
  taskRows = el('div', '', form, 'task-data-list');
  const tasks = state.tasks.filter(x => x.templateId === source.templateId);
  const makeTaskRow = (task = {}) => {
    const row = el('div', '', taskRows, 'task-data-row');
    const name = el('input', '', row); name.placeholder = '任务名，例如 COD1'; name.setAttribute('aria-label', '任务名称'); name.value = task.name || ''; name.required = true;
    const values = {};
    for (const mapping of mappingsState.filter(x => x.row.isConnected)) {
      const key = mapping.variable.value.trim() || `variable${Object.keys(values).length + 1}`;
      if (key === 'taskName' || (needsTaskText && ['taskText', 'historyText'].includes(key))) continue;
      const control = el(key === 'historyText' || /(?:text|note|history|content|病史|内容|记录)/i.test(key) ? 'textarea' : 'input', '', row);
      control.placeholder = key === 'searchWord' ? '患者姓名或编号' : key === 'historyText' ? '粘贴或填写病史内容' : key;
      control.setAttribute('aria-label', key); control.value = task.variables?.[key] || ''; control.required = true; values[key] = control;
    }
    if (needsTaskText) {
      const control = el('textarea', '', row); control.placeholder = '本任务正文（最多4000字）'; control.setAttribute('aria-label', '任务正文'); control.value = task.variables?.taskText || task.variables?.historyText || ''; control.maxLength = 4000; control.required = true; values.taskText = control;
    }
    button(row, '删除任务行', () => row.remove());
    return { row, name, values };
  };
  function rebuildTaskRows() {
    if (!taskRows) return;
    const current = taskRowStates.filter(x => x.row.isConnected).map(x => ({ name: x.name.value, variables: Object.fromEntries(Object.entries(x.values).map(([key, control]) => [key, control.value])) }));
    taskRows.replaceChildren();
    taskRowStates = current.map(makeTaskRow);
  }
  taskRowStates = tasks.length ? tasks.map(makeTaskRow) : [makeTaskRow({ name: `${t.groupName}1` }), makeTaskRow({ name: `${t.groupName}2` })];
  button(form, '＋ 添加任务', () => taskRowStates.push(makeTaskRow()));
  const status = el('p', '', form); status.setAttribute('role', 'status');
  const save = el('button', '保存并生成任务', form, 'primary'); save.type = 'submit';
  button(form, '取消', () => dialog.close()); dialog.onclose = () => dialog.remove();
  form.onsubmit = async e => { e.preventDefault(); save.disabled = true; try {
    if (!candidates.length && !needsTaskText) throw new Error('此模板没有可变化的输入步骤，请先录制一次输入');
    const activeMappings = mappingsState.filter(x => x.row.isConnected);
    if (!activeMappings.length && !needsTaskText) throw new Error('至少绑定一个输入步骤');
    const variableNames = activeMappings.map(x => x.variable.value.trim());
    if (variableNames.some(x => !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(x) || ['constructor', 'prototype', '__proto__'].includes(x))) throw new Error('变量名称格式无效或使用了保留字');
    if (new Set(variableNames).size !== variableNames.length) throw new Error('变量名称不能重复');
    if (new Set(activeMappings.map(x => x.stepSelect.value)).size !== activeMappings.length) throw new Error('同一个输入步骤只能绑定一个变量');
    const rows = taskRowStates.filter(x => x.row.isConnected);
    if (!rows.length || rows.length > 50) throw new Error('请输入1至50个任务');
    const names = rows.map(x => x.name.value.trim());
    if (names.some(x => !x) || new Set(names).size !== names.length) throw new Error('任务名称不能为空且不能重复');
    if (rows.some(row => activeMappings.some(mapping => mapping.variable.value.trim() !== 'taskName' && !row.values[mapping.variable.value.trim()]?.value.trim()))) throw new Error('每个任务都要填写患者信息和已绑定的内容');
    if (needsTaskText && rows.some(row => !row.values.taskText?.value.trim())) throw new Error('每个任务都要填写任务正文');
    const next = structuredClone(source);
    for (const mapping of activeMappings) next.steps[Number(mapping.stepSelect.value)].value = `{${mapping.variable.value.trim()}}`;
    const allVars = [...new Set(JSON.stringify(next.steps).match(/\{([A-Za-z_]\w*)\}/g) || [])].map(x => x.slice(1, -1));
    if (allVars.some(key => !variableNames.includes(key))) throw new Error(`模板还包含未绑定的变量：${allVars.filter(key => !variableNames.includes(key)).join(', ')}`);
    await send({ type: 'SAVE_TEMPLATE', template: next });
    for (const row of rows) {
      const name = row.name.value.trim();
      const existing = state.tasks.find(x => x.templateId === source.templateId && x.name === name);
      const variables = Object.fromEntries(activeMappings.filter(mapping => mapping.variable.value.trim() !== 'taskName' && !(needsTaskText && ['taskText', 'historyText'].includes(mapping.variable.value.trim()))).map(mapping => { const key = mapping.variable.value.trim(); return [key, row.values[key].value]; }));
      if (needsTaskText) variables.taskText = row.values.taskText.value;
      await send({ type: 'SAVE_TASK', task: { instanceId: existing?.instanceId || crypto.randomUUID(), templateId: source.templateId, name, variables } });
    }
    dialog.close(); await refresh(); notice('已保存共享流程及每个任务的数据，可在任务工作台运行');
  } catch (error) { status.textContent = error.message; save.disabled = false; } };
  dialog.showModal();
}
function renderRuns(parent) {
  const bar = el('div', '', parent, 'section-title'); el('h2', '最近 100 次执行', bar); button(bar, '刷新记录', refresh);
  if (!state.runs.length) { el('div', '还没有执行记录，先运行一个演示任务。', parent, 'empty'); return; }
  const table = el('table', '', parent); const head = el('tr', '', el('thead', '', table)); ['任务', '状态', '步骤进度', '发起时间', '说明'].forEach(x => el('th', x, head));
  const body = el('tbody', '', table);
  for (const r of state.runs) { const row = el('tr', '', body); [r.name, labels[r.status] || r.status, `${r.index}/${r.total}`, new Date(r.startedAt).toLocaleString('zh-CN'), r.error || '—'].forEach(x => el('td', x, row)); }
}
function renderSettings(parent) {
  const box = el('form', '', parent, 'box'); el('h2', '网页授权', box); el('p', '每行填写一个完整来源（协议 + 主机 + 端口）。默认仅授权本机演示网页；当前版本只使用插件内的模拟任务收件箱，不启用真实外部接收。', box);
  const label = el('label', '允许执行与录制的网页来源', box); label.htmlFor = 'targets'; const targets = el('textarea', '', box); targets.id = 'targets'; targets.value = state.settings.targetOrigins.join('\n');
  const save = el('button', '保存连接设置', box, 'primary'); save.type = 'submit';
  box.onsubmit = async e => { e.preventDefault(); try { const split = value => value.split('\n').map(s => s.trim()).filter(Boolean); await send({ type: 'SETTINGS', settings: { targetOrigins: split(targets.value), externalOrigins: [], externalEnabled: false } }); notice('网页授权已保存；真实外部接收保持关闭'); await refresh(); } catch (error) { notice(error.message); } };
  const mock = el('div', '', parent, 'box'); el('h2', '模拟任务来源', mock); el('p', '当前不连接外部系统。请到“任务工作台 → 模拟下发任务”选择一条本地预置任务；任务正文可编辑、保存、复制，并随运行流程填入病历指定位置。', mock);
}
document.querySelectorAll('[data-view]').forEach(n => n.onclick = () => { view = n.dataset.view; notice(''); render(); });
$('#demo').onclick = () => chrome.tabs.create({ url: 'http://127.0.0.1:4173/' });
$('#close-editor').onclick = () => $('#editor').close();
$('#editor-form').onsubmit = async e => { e.preventDefault(); try { const value = JSON.parse($('#json-editor').value); await send({ type: editing, [editing === 'SAVE_TEMPLATE' ? 'template' : 'task']: value }); $('#editor').close(); notice('配置已保存'); await refresh(); } catch (error) { notice(error.message); } };
$('#import-file').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 2_000_000) throw new Error('备份不能超过2MB'); const data = JSON.parse(await file.text()); if (confirm('将用备份替换现有模板和任务；请先导出当前配置。继续？')) { await send({ type: 'IMPORT', data }); await refresh(); notice('备份已导入'); } } catch (error) { notice(error.message); } finally { e.target.value = ''; } };
refresh().catch(e => notice(e.message));

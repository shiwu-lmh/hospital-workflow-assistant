import { configureBindings, patientVariableForSelector, describeStep, reorderStep, removeStep } from './core.js';

const $ = selector => document.querySelector(selector);
let state, view = 'tasks', editing, selectedMockTaskId, openStepTemplateId, backgroundSupportsPasteBindings = false;
const names = { tasks: '任务工作台', templates: '流程模板', runs: '执行记录', settings: '连接与设置' };
const labels = { running: '执行中', success: '成功', failed: '失败', interrupted: '中断待核对', stopped: '已停止' };
const patientLabel = task => task.variables.patientName || task.variables.searchWord || '未配置';
const el = (tag, value, parent, cls) => { const n = document.createElement(tag); if (value !== undefined && value !== null) n.textContent = value; if (cls) n.className = cls; parent?.append(n); return n; };
function notice(message) {
  const box = $('#notice'); box.replaceChildren(); box.hidden = !message;
  if (!message) return;
  el('span', message, box);
  if (/没有打开授权的业务页|未打开授权/.test(message)) {
    const demo = el('button', '打开演示 HIS', box, 'primary'); demo.onclick = () => chrome.tabs.create({ url: 'http://127.0.0.1:4174/' });
    const settings = el('button', '设置真实 HIS 地址', box); settings.onclick = () => { view = 'settings'; render(); };
    el('p', '演示页需要先运行项目目录里的 npm run demo；使用医院系统时，先到“连接与设置”加入 HIS 地址。', box);
  }
}
const send = async m => { const r = await chrome.runtime.sendMessage(m); if (!r?.ok) throw new Error(r?.error || '后台连接失败'); return r; };
function button(parent, label, action, cls) { const n = el('button', label, parent, cls); n.type = 'button'; n.onclick = () => Promise.resolve().then(action).catch(e => notice(e.message)); return n; }
async function refresh() { const r = await send({ type: 'STATE' }); state = r.state; state.extensionId = r.extensionId; backgroundSupportsPasteBindings = r.capabilities?.pasteBindings === true && r.capabilities?.explicitBindings === true; render(); }
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
      el('h3', task.name, card); el('p', template.steps.length ? template.name : '尚未录制，请先人工演示本组流程', card); el('p', `患者：${patientLabel(task)}`, card);
      const taskText = task.variables.taskText || task.variables.historyText || '';
      const needsTaskText = template.steps.some(step => step.type === 'paste' && !step.disabled);
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
  el('p', '这里是每条任务的数据来源。姓名、编号、年龄、自定义变量和正文都在这里保存；流程配置与此处使用同一份数据，运行时读取当前任务的变量值。', parent, 'hint');
  const tasks = state.tasks;
  if (!tasks.length) {
    const empty = el('div', '', parent, 'empty');
    el('p', '暂无模拟任务。可以恢复 18 条内置示例（COD 12 条、A 6 条），包含虚构患者姓名、编号和不同正文。', empty);
    button(empty, '恢复示例任务', async () => { await send({ type: 'RESTORE_DEMO_TASKS' }); selectedMockTaskId = 'demo-COD1'; await refresh(); notice('已补充内置示例任务（COD 12 条、A 6 条）；未覆盖已有任务。'); }, 'primary');
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
    el('strong', task.name, item); el('span', `患者：${patientLabel(task)}${task.variables.patientId ? ` · ${task.variables.patientId}` : ''}`, item);
    item.onclick = () => { selectedMockTaskId = task.instanceId; render(); };
  }
  const editor = el('div', '', layout, 'mock-document');
  const head = el('div', '', editor, 'mock-document-head');
  const heading = el('div', '', head); el('small', '模拟来源数据 · 可编辑', heading); el('h3', `${selected.name} · 任务数据`, heading);
  const chip = el('span', '本机模拟数据', head, 'chip');
  const patient = el('div', '', editor, 'mock-patient'); el('span', '受试者 / 患者', patient); el('strong', `${patientLabel(selected)}${selected.variables.patientId ? ` · ${selected.variables.patientId}` : ''}`, patient);
  const declared = new Set((template?.bindings || []).map(binding => binding.variable));
  for (const step of template?.steps || []) if (!step.disabled && ['input', 'select'].includes(step.type)) for (const match of String(step.value || '').matchAll(/\{([A-Za-z_]\w*)\}/g)) declared.add(match[1]);
  const fieldNames = [...new Set([...['patientName', 'patientId', 'age', 'searchWord'].filter(key => Object.hasOwn(selected.variables, key) || declared.has(key)), ...Object.keys(selected.variables), ...declared])].filter(key => !['taskName', 'taskText', 'historyText'].includes(key));
  const fieldLabels = { patientName: '患者姓名', patientId: '患者编号', age: '年龄', sex: '性别', department: '就诊科室', phone: '联系电话', searchWord: '查询值（姓名或编号）' };
  const fields = el('div', '', editor, 'mock-variable-fields'), inputs = {};
  for (const key of fieldNames) {
    const label = el('label', `${key}${fieldLabels[key] ? ` · ${fieldLabels[key]}` : ''}`, fields);
    const input = el(/(?:text|note|history|content)/i.test(key) ? 'textarea' : 'input', '', label);
    input.setAttribute('aria-label', `${selected.name} ${key}`); input.maxLength = 4000;
    input.value = selected.variables[key] ?? (key === 'searchWord' ? selected.variables.patientName : key === 'patientName' ? selected.variables.searchWord : '') ?? '';
    inputs[key] = input;
  }
  let previousName = inputs.patientName?.value;
  inputs.patientName?.addEventListener('input', () => { if (inputs.searchWord?.value === previousName) inputs.searchWord.value = inputs.patientName.value; previousName = inputs.patientName.value; });
  const bodyLabel = el('label', 'taskText · 任务正文（模拟外部传入）', editor);
  const body = el('textarea', '', bodyLabel, 'mock-body'); body.value = selected.variables.taskText || selected.variables.historyText || ''; body.maxLength = 4000; body.setAttribute('aria-label', `${selected.name}任务正文`);
  const actions = el('div', '', editor, 'mock-actions');
  const saveSource = async () => {
    const variables = { ...selected.variables, ...Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value])), taskText: body.value };
    if (declared.has('taskName')) variables.taskName = selected.name;
    const missing = [...declared].filter(key => key !== 'taskName' && !String(variables[key] || '').trim());
    if (missing.length) throw new Error(`请填写任务所需变量：${missing.join('、')}`);
    await send({ type: 'SAVE_TASK', task: { ...selected, variables } });
    return variables;
  };
  button(actions, '保存模拟任务', async () => {
    await saveSource();
    notice(`${selected.name} 模拟任务已保存到插件本地`); await refresh();
  }, 'primary');
  button(actions, '复制正文', async () => { await navigator.clipboard.writeText(body.value); notice(`${selected.name} 的模拟正文已复制`); });
  const canRun = template?.steps.some(step => !step.disabled);
  button(actions, canRun ? '运行这条任务 →' : '先录制流程', async () => {
    if (!canRun) throw new Error('请先录制并保存对应分组的操作流程');
    const tabId = await targetTab();
    await saveSource();
    await send({ type: 'RUN', instanceId: selected.instanceId, tabId });
    notice(`已读取并运行 ${selected.name} 当前保存的任务数据`); await refresh();
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
  button(tools, '＋ 空白模板', () => edit('SAVE_TEMPLATE', { templateId: crypto.randomUUID(), name: '新模板', groupName: 'COD', startUrl: 'http://127.0.0.1:4174/', steps: [{ type: 'input', selector: '#search-word', value: '{searchWord}', timeout: 15000 }] }), 'primary');
  if (state.recording) { const box = el('div', '', parent, 'box'); el('h2', `正在录制：${state.recording.name} · ${state.recording.steps.length} 步`, box); button(box, '保存录制', async () => { const flushed = await chrome.tabs.sendMessage(state.recording.tabId, { type: 'FLUSH_RECORDING' }, { frameId: 0 }); if (!flushed?.ok) throw new Error(flushed?.error || '录制页没有响应；请切回录制页面后重试保存'); const saved = await send({ type: 'RECORD_STOP' }); await refresh(); notice(saved.boundVariable ? `录制已保存；第 ${saved.boundStep} 个文本输入已自动绑定为搜索变量。现在为各个任务填写搜索值即可。` : '录制已保存；未检测到文本输入，请检查是否录到了搜索步骤。'); }); button(box, '丢弃录制', () => send({ type: 'RECORD_STOP', discard: true }).then(refresh)); }
  const grid = el('div', '', parent, 'cards');
  for (const t of state.templates) {
    const card = el('article', '', grid, 'card'); el('span', t.groupName, card, 'chip'); el('h3', t.name, card); el('p', `${t.steps.length} 个步骤 · ${new URL(t.startUrl).host}`, card); el('p', `模板 ID：${t.templateId}`, card);
    const configure = button(card, '配置变量并生成任务', async () => { await refresh(); if (state.recording) throw new Error('请先保存录制，变量配置会读取刚保存的流程步骤'); const latest = state.templates.find(x => x.templateId === t.templateId); if (!latest) throw new Error('流程模板已不存在，请刷新页面'); parameterize(latest); }, 'primary'); configure.disabled = !!state.recording;
    const actions = el('div', '', card, 'card-actions'); button(actions, '高级编辑 JSON', () => edit('SAVE_TEMPLATE', t)); button(actions, openStepTemplateId === t.templateId ? '收起步骤编辑' : '可视化编辑步骤', () => { openStepTemplateId = openStepTemplateId === t.templateId ? null : t.templateId; render(); }); button(actions, '删除', async () => { if (confirm(`删除模板“${t.name}”及关联任务？可从事先导出的备份恢复。`)) { await send({ type: 'DELETE_TEMPLATE', id: t.templateId }); await refresh(); } });
    if (openStepTemplateId === t.templateId) renderStepEditor(card, t);
  }
  el('div', '录制时在目标正文框粘贴一次示例，即可记录“把任务正文填入此处”的位置。测试运行可从“模拟下发任务”选择预置正文；各任务内容保存在插件本地。', parent, 'hint');
}
function renderStepEditor(parent, source) {
  const editor = el('section', '', parent, 'step-editor');
  const heading = el('div', '', editor, 'step-editor-heading'); el('h4', '流程步骤', heading); el('span', '点击上下箭头调整顺序；删除和重排会自动保存。', heading);
  pagePicker(editor).catch(error => notice(error.message));
  const linkedTasks = state.tasks.filter(item => item.templateId === source.templateId);
  const taskLabel = el('label', '试运行使用的任务数据', editor, 'step-task-label');
  const taskSelect = el('select', '', taskLabel); taskSelect.setAttribute('aria-label', `${source.name}试运行任务`);
  for (const task of linkedTasks) { const option = el('option', `${task.name} · ${patientLabel(task)}${task.variables.patientId ? ` · ${task.variables.patientId}` : ''}`, taskSelect); option.value = task.instanceId; }
  if (!linkedTasks.length) { const option = el('option', '此模板还没有关联任务', taskSelect); option.value = ''; }
  taskSelect.disabled = !linkedTasks.length;
  const list = el('ol', '', editor, 'step-list');
  source.steps.forEach((step, index) => {
    const row = el('li', '', list, `step-row${step.disabled ? ' disabled' : ''}`);
    el('span', String(index + 1).padStart(2, '0'), row, 'step-number');
    const description = el('div', '', row, 'step-description');
    el('strong', describeStep(step), description);
    const variable = source.bindings?.find(binding => binding.stepIndex === index)?.variable || String(step.value || '').match(/\{([A-Za-z_]\w*)\}/)?.[1];
    if (variable) el('span', `变量：${variable}`, description, 'step-variable');
    else if (step.disabled) el('span', '已停用', description, 'step-variable');
    if (step.selector) el('code', step.selector, description, 'step-selector');
    const controls = el('div', '', row, 'step-controls');
    const up = button(controls, '上移', async () => saveStepTemplate(reorderStep(source, index, -1))); up.disabled = index === 0;
    const down = button(controls, '下移', async () => saveStepTemplate(reorderStep(source, index, 1))); down.disabled = index === source.steps.length - 1;
    const trial = button(controls, '单步试运行', async () => {
      if (!linkedTasks.length) throw new Error('请先关联一条模拟任务，单步运行需要使用该任务变量');
      if (['click', 'key'].includes(step.type) && !confirm(`即将在当前授权网页执行“${describeStep(step)}”。此操作可能提交或跳转页面，确认继续？`)) return;
      const tabId = await targetTab();
      await send({ type: 'RUN_STEP', templateId: source.templateId, stepIndex: index, instanceId: taskSelect.value, tabId });
      notice(`已在授权网页试运行第 ${index + 1} 步：${describeStep(step)}`);
    }, 'step-trial'); trial.disabled = !!step.disabled || !!state.activeRun || !!state.recording;
    button(controls, '删除', async () => saveStepTemplate(removeStep(source, index)), 'danger');
  });
}
async function saveStepTemplate(next) {
  await send({ type: 'SAVE_TEMPLATE', template: next });
  openStepTemplateId = next.templateId;
  await refresh();
  notice('步骤已保存；变量绑定已随步骤同步更新');
}
function removeRedundantNavigation(steps) {
  const normalized = [];
  const indexMap = new Map();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    indexMap.set(i, normalized.length);
    if (step.type === 'click' && steps[i + 1]?.type === 'navigate') {
      normalized.push({ ...step, followNavigation: true });
      indexMap.set(i + 1, null);
      i++; // The click itself performs this page transition; replay it against the current result, not its recorded URL.
    } else normalized.push(step);
  }
  return { steps: normalized, indexMap };
}
function editTask(task) {
  const dialog = el('dialog', '', document.body), form = el('form', '', dialog, 'box');
  const linkedTemplate = state.templates.find(t => t.templateId === task.templateId);
  const needsTaskText = linkedTemplate?.steps.some(step => step.type === 'paste' && !step.disabled) === true;
  const requiredVars = linkedTemplate?.bindingsConfigured ? [...new Set(linkedTemplate.bindings.map(binding => binding.variable))]
    : [...new Set((JSON.stringify(linkedTemplate?.steps.filter(step => !step.disabled) || []).match(/\{([A-Za-z_]\w*)\}/g) || []).map(x => x.slice(1, -1)))];
  const savedVars = linkedTemplate?.bindingsConfigured ? Object.fromEntries(requiredVars.map(key => [key, task.variables[key] || ''])) : task.variables;
  const taskVars = { ...Object.fromEntries(requiredVars.map(key => [key, key === 'taskName' ? task.name : key === 'searchWord' ? '林小禾' : ''])), ...savedVars, ...(requiredVars.includes('taskName') ? { taskName: task.name } : {}), ...(needsTaskText ? { taskText: task.variables.taskText || task.variables.historyText || '' } : {}) };
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
  const normalized = removeRedundantNavigation(t.steps);
  const source = {
    ...t,
    steps: normalized.steps,
    bindings: (t.bindings || []).flatMap(binding => {
      const stepIndex = normalized.indexMap.get(binding.stepIndex);
      return stepIndex == null ? [] : [{ ...binding, stepIndex }];
    }),
  };
  const needsTaskText = source.steps.some(step => step.type === 'paste');
  const dialog = el('dialog', '', document.body), form = el('form', '', dialog, 'box');
  el('h2', `${source.name} · 任务数据配置`, form);
  el('p', '上方把录制的输入步骤绑定到变量名；若流程包含粘贴正文，会自动绑定到 taskText。下方按任务名称读取“模拟下发任务”中的对应数据，保存后运行会使用这些值。', form);
  el('p', '移除变量后，对应的变量输入步骤将停止自动填写；保存后重新打开会保留你选择的变量列表。', form, 'hint');
  el('p', '已有任务的变量值来自“模拟下发任务”，在这里显示为只读；需要修改时，请到任务工作台编辑对应来源任务。新加的变量尚无来源值时，可先在这里填写，保存后也会成为来源任务数据。', form, 'hint');
  const pasteTargets = new Set(source.steps.filter(step => step.type === 'paste').map(step => step.selector));
  const storedBindings = new Map(source.bindings.map(binding => [binding.stepIndex, binding.variable]));
  const allCandidates = source.steps.map((step, index) => ({ step, index })).filter(candidate => ['input', 'select', 'paste'].includes(candidate.step.type));
  const suggestedVariable = step => {
    if (step.type === 'paste' || pasteTargets.has(step.selector)) return 'taskText';
    return patientVariableForSelector(step.selector);
  };
  const recordedVariable = ({ step, index }) => {
    if (storedBindings.has(index)) return storedBindings.get(index);
    const placeholder = String(step.value || '').match(/\{([A-Za-z_]\w*)\}/)?.[1];
    if (!placeholder) return '';
    const suggested = suggestedVariable(step);
    return suggested && (placeholder === 'searchWord' || /^variable\d+$/.test(placeholder)) ? suggested : placeholder;
  };
  const inputGroups = new Map();
  for (const candidate of allCandidates) {
    if (!['input', 'select'].includes(candidate.step.type) || pasteTargets.has(candidate.step.selector)) continue;
    if (!inputGroups.has(candidate.step.selector)) inputGroups.set(candidate.step.selector, []);
    inputGroups.get(candidate.step.selector).push(candidate);
  }
  const inputCandidates = [...inputGroups.values()].flatMap(group => {
    const explicit = group.filter(candidate => storedBindings.has(candidate.index) || /\{[A-Za-z_]\w*\}/.test(String(candidate.step.value || '')));
    const preferred = explicit.length ? explicit : group.slice(0, 1);
    const seenVariables = new Set();
    return preferred.filter(candidate => {
      const variable = recordedVariable(candidate);
      if (!variable) return true;
      if (seenVariables.has(variable)) return false;
      seenVariables.add(variable);
      return true;
    });
  });
  const pasteCandidates = allCandidates.filter(candidate => candidate.step.type === 'paste');
  const pasteRepresentative = pasteCandidates.find(candidate => storedBindings.get(candidate.index) === 'taskText') || pasteCandidates[0];
  const candidateIndexes = new Set([...inputCandidates, ...(pasteRepresentative ? [pasteRepresentative] : [])].map(candidate => candidate.index));
  const candidates = allCandidates.filter(candidate => candidateIndexes.has(candidate.index));
  const mappings = el('div', '', form, 'mapping-list');
  if (!candidates.length) el('p', '当前流程没有可绑定的输入或正文粘贴步骤。请先在 HIS 中录制患者信息输入或病历正文粘贴，再保存录制。', mappings, 'hint');
  if (pasteCandidates.length > 1) el('p', '一个 taskText 变量会供本流程中的所有正文粘贴位置共用。', form, 'hint');
  let taskRows, taskRowStates = [];
  const addMapping = (stepIndex, variableName) => {
    const row = el('div', '', mappings, 'mapping-row');
    const stepSelect = el('select', '', row); stepSelect.required = true;
    for (const { step, index } of candidates) { const description = step.type === 'paste' ? `粘贴正文 · ${step.selector}` : `${step.selector} · ${String(step.value || '').slice(0, 50)}`; const option = el('option', `第${index + 1}步 · ${description}`, stepSelect); option.value = index; }
    if (stepIndex != null) stepSelect.value = String(stepIndex);
    const variable = el('input', '', row); variable.placeholder = '变量名，例如 historyText'; variable.value = variableName || ''; variable.required = true; variable.pattern = '[A-Za-z_][A-Za-z0-9_]{0,63}'; variable.setAttribute('aria-label', '变量名称');
    const syncPasteBinding = () => { const selected = candidates.find(candidate => candidate.index === Number(stepSelect.value)); variable.readOnly = selected?.step.type === 'paste' || pasteTargets.has(selected?.step.selector); if (variable.readOnly) variable.value = 'taskText'; };
    syncPasteBinding();
    variable.addEventListener('change', rebuildTaskRows);
    stepSelect.addEventListener('change', () => { syncPasteBinding(); rebuildTaskRows(); });
    button(row, '移除', () => { row.remove(); rebuildTaskRows(); });
    return { row, stepSelect, variable, valueKey: variable.value.trim() };
  };
  const bound = candidates.flatMap(({ step, index }) => [...String(step.value || '').matchAll(/\{([A-Za-z_]\w*)\}/g)].map(match => {
    const suggested = suggestedVariable(step);
    return { index, key: suggested && (match[1] === 'searchWord' || /^variable\d+$/.test(match[1])) ? suggested : match[1] };
  }));
  const mappingsState = [];
  const boundByIndex = new Map(bound.map(item => [item.index, item.key]));
  for (const candidate of candidates) {
    const variableName = source.bindingsConfigured ? storedBindings.get(candidate.index)
      : storedBindings.get(candidate.index) || boundByIndex.get(candidate.index) || suggestedVariable(candidate.step);
    if (variableName) mappingsState.push(addMapping(candidate.index, variableName));
  }
  if (!source.bindingsConfigured && !mappingsState.length && candidates.length) mappingsState.push(addMapping(candidates[0].index, suggestedVariable(candidates[0].step) || 'searchWord'));
  const addVariable = button(form, '＋ 添加一个可变化的输入', () => { if (!candidates.length) return; mappingsState.push(addMapping(candidates[0].index, `variable${mappingsState.length + 1}`)); rebuildTaskRows(); }); addVariable.disabled = !candidates.length;
  taskRows = el('div', '', form, 'task-data-list');
  const tasks = state.tasks.filter(x => x.templateId === source.templateId);
  const taskDataKeys = () => [...new Set([
    'patientName', 'patientId', 'age', 'searchWord', 'taskText',
    ...tasks.flatMap(task => Object.keys(task.variables || {})),
    ...mappingsState.filter(mapping => mapping.row.isConnected).map(mapping => mapping.variable.value.trim()),
  ])].filter(key => key && key !== 'taskName');
  const variableLabels = { patientName: '患者姓名', patientId: '患者编号', age: '年龄', searchWord: '查询值（姓名或编号）', taskText: '任务正文' };
  const makeTaskRow = (task = {}) => {
    const row = el('div', '', taskRows, 'task-data-row');
    const nameField = el('label', '任务名称', row, 'task-data-field');
    const name = el('input', '', nameField); name.placeholder = '例如 COD1'; name.setAttribute('aria-label', '任务名称'); name.value = task.name || ''; name.required = true;
    const values = {};
    const requiredKeys = new Set(mappingsState.filter(mapping => mapping.row.isConnected).map(mapping => mapping.variable.value.trim()).filter(key => key && key !== 'taskName'));
    for (const key of taskDataKeys()) {
      const sourceKeys = key === 'taskText' ? ['taskText', 'historyText']
        : key === 'patientName' ? ['patientName', 'searchWord']
          : key === 'searchWord' ? ['searchWord', 'patientName'] : [key];
      const sourceValueExists = sourceKeys.some(sourceKey => Object.hasOwn(task.variables || {}, sourceKey));
      const fromSource = Boolean(task.instanceId && sourceValueExists);
      const fieldLabel = `${key}${variableLabels[key] ? ` · ${variableLabels[key]}` : ''}`;
      const field = el('label', `${fieldLabel}${fromSource ? ' · 来源任务' : ''}`, row, 'task-data-field');
      const control = el(['taskText', 'historyText'].includes(key) || /(?:text|note|history|content|病史|内容|记录)/i.test(key) ? 'textarea' : 'input', '', field);
      control.placeholder = key === 'searchWord' ? '患者姓名或编号' : key === 'historyText' ? '粘贴或填写病史内容' : key;
      const sampleValue = key === 'taskText' ? task.variables?.taskText || task.variables?.historyText
        : key === 'patientName' ? task.variables?.searchWord
        : key === 'searchWord' ? task.variables?.patientName : '';
      control.setAttribute('aria-label', key === 'taskText' ? 'taskText 任务正文变量' : key); control.value = task.variables?.[key] ?? sampleValue ?? ''; control.required = requiredKeys.has(key); control.maxLength = 4000;
      control.readOnly = fromSource;
      if (fromSource) control.title = '此值读取自对应的模拟下发任务；请到任务工作台修改来源数据';
      values[key] = control;
    }
    button(row, '删除任务行', () => row.remove());
    return { row, name, values, sourceVariables: { ...task.variables }, instanceId: task.instanceId };
  };
  function rebuildTaskRows() {
    if (!taskRows) return;
    const activeMappings = mappingsState.filter(mapping => mapping.row.isConnected);
    const current = taskRowStates.filter(x => x.row.isConnected).map(x => {
      const variables = { ...x.sourceVariables, ...Object.fromEntries(Object.entries(x.values).map(([key, control]) => [key, control.value])) };
      for (const mapping of activeMappings) {
        const key = mapping.variable.value.trim();
        if (key && !Object.hasOwn(variables, key) && Object.hasOwn(variables, mapping.valueKey)) variables[key] = variables[mapping.valueKey];
      }
      return { name: x.name.value, variables, instanceId: x.instanceId };
    });
    for (const mapping of activeMappings) mapping.valueKey = mapping.variable.value.trim();
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
    if (!backgroundSupportsPasteBindings) throw new Error('插件后台仍是旧版本。请在浏览器扩展管理页找到“院内流程助手”，点击“重新加载”（圆箭头），再刷新工作台并重新打开配置。仅刷新工作台不会更新后台。');
    const variableNames = activeMappings.map(x => x.variable.value.trim());
    if (variableNames.some(x => !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(x) || ['constructor', 'prototype', '__proto__'].includes(x))) throw new Error('变量名称格式无效或使用了保留字');
    if (new Set(activeMappings.map(x => x.stepSelect.value)).size !== activeMappings.length) throw new Error('同一个输入步骤只能绑定一个变量');
    const rows = taskRowStates.filter(x => x.row.isConnected);
    if (!rows.length || rows.length > 50) throw new Error('请输入1至50个任务');
    const names = rows.map(x => x.name.value.trim());
    if (names.some(x => !x) || new Set(names).size !== names.length) throw new Error('任务名称不能为空且不能重复');
    if (rows.some(row => activeMappings.some(mapping => mapping.variable.value.trim() !== 'taskName' && !row.values[mapping.variable.value.trim()]?.value.trim()))) throw new Error('每个任务都要填写患者信息和已绑定的内容');
    const next = configureBindings(source, activeMappings.map(mapping => ({ stepIndex: Number(mapping.stepSelect.value), variable: mapping.variable.value.trim() })));
    await send({ type: 'SAVE_TEMPLATE', template: next });
    for (const row of rows) {
      const name = row.name.value.trim();
      const existing = row.instanceId
        ? state.tasks.find(x => x.instanceId === row.instanceId)
        : state.tasks.find(x => x.templateId === source.templateId && x.name === name);
      const visibleValues = Object.fromEntries(Object.entries(row.values).filter(([key, control]) => control.value !== '' || Object.hasOwn(row.sourceVariables, key)).map(([key, control]) => [key, control.value]));
      const variables = { ...existing?.variables, ...row.sourceVariables, ...visibleValues };
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
$('#demo').onclick = () => chrome.tabs.create({ url: 'http://127.0.0.1:4174/' });
$('#close-editor').onclick = () => $('#editor').close();
$('#editor-form').onsubmit = async e => { e.preventDefault(); try { const value = JSON.parse($('#json-editor').value); await send({ type: editing, [editing === 'SAVE_TEMPLATE' ? 'template' : 'task']: value }); $('#editor').close(); notice('配置已保存'); await refresh(); } catch (error) { notice(error.message); } };
$('#import-file').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 2_000_000) throw new Error('备份不能超过2MB'); const data = JSON.parse(await file.text()); if (confirm('将用备份替换现有模板和任务；请先导出当前配置。继续？')) { await send({ type: 'IMPORT', data }); await refresh(); notice('备份已导入'); } } catch (error) { notice(error.message); } finally { e.target.value = ''; } };
refresh().catch(e => notice(e.message));

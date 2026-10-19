export const MAX_STEPS = 500;
export const DEMO_TASK_BODY = '脉率，xx次/分；体温，xx.x℃；血压xxx/xxx mmHg。如有异常请说明。于xx时xx分，完成给药后2h的12导联心电图检查。如有异常请说明。\n于xx时xx分，完成给药后4h生命体征测量：呼吸频率，xx次/分；脉率，xx次/分；体温，xx.x℃；血压xxx/xxx mmHg。如有异常请说明。\n于xx时xx分，完成给药后6h生命体征测量：呼吸频率，xx次/分；脉率，xx次/分；体温，xx.x℃；血压xxx/xxx mmHg。如有异常请说明。于xx时xx分，完成给药后6h的12导联心电图检查。';
const badKeys = new Set(['__proto__', 'constructor', 'prototype']);
export function ensure(ok, message) { if (!ok) throw new Error(message); }
export function text(value, label, max = 200) {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label}无效`);
  return value.trim();
}
export function httpUrl(value) {
  const url = new URL(value);
  ensure(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, '仅支持 HTTP/HTTPS 网页');
  return url;
}
export function variables(value) {
  ensure(value && typeof value === 'object' && !Array.isArray(value), '变量必须是对象');
  ensure(Object.keys(value).length <= 50, '变量数量不能超过50');
  const result = Object.create(null);
  for (const [key, val] of Object.entries(value)) {
    ensure(/^[A-Za-z_][\w]{0,63}$/.test(key) && !badKeys.has(key), '变量名无效');
    ensure(typeof val === 'string' && val.length <= 4000, '变量值必须是4000字以内的字符串');
    result[key] = val;
  }
  return result;
}
export function interpolate(value, vars) {
  return value.replace(/\{([A-Za-z_]\w*)\}/g, (_, key) => {
    ensure(Object.hasOwn(vars, key), `缺少变量：${key}`);
    return vars[key];
  });
}
export function template(value) {
  ensure(value && typeof value === 'object', '模板无效');
  const result = { templateId: text(value.templateId, '模板ID'), name: text(value.name, '模板名称'), groupName: text(value.groupName, '分组'), startUrl: httpUrl(value.startUrl).href, steps: [] };
  ensure(Array.isArray(value.steps) && value.steps.length <= MAX_STEPS, '模板最多500个步骤');
  const origin = new URL(result.startUrl).origin;
  for (const s of value.steps) {
    ensure(s && ['click', 'input', 'select', 'check', 'scroll', 'navigate', 'wait', 'key', 'paste'].includes(s.type), '不支持的步骤类型');
    const step = { type: s.type, timeout: s.timeout ?? 15000 };
    if (s.type === 'click' && s.followNavigation === true) step.followNavigation = true;
    ensure(Number.isInteger(step.timeout) && step.timeout >= 100 && step.timeout <= 25000, '等待时间需在100至25000毫秒之间');
    if (s.type === 'navigate') {
      step.url = httpUrl(s.url).href;
      ensure(new URL(step.url).origin === origin, 'MVP仅允许同源跳转');
    } else if (s.type === 'scroll') {
      ensure(Number.isFinite(s.x) && Number.isFinite(s.y) && Math.abs(s.x) < 1e7 && Math.abs(s.y) < 1e7, '滚动位置无效');
      step.x = s.x; step.y = s.y;
    } else {
      step.selector = text(s.selector, '选择器', 2000);
      if (['input', 'select'].includes(s.type)) { ensure(typeof s.value === 'string' && s.value.length <= 4000, '输入值无效'); step.value = s.value; }
      if (s.type === 'check') { ensure(typeof s.checked === 'boolean', '勾选值无效'); step.checked = s.checked; }
      if (s.type === 'key') { ensure(['Enter', 'Tab', 'Escape'].includes(s.key), '不支持的按键'); step.key = s.key; }
    }
    result.steps.push(step);
  }
  return result;
}
export function task(value, templates) {
  ensure(value && typeof value === 'object', '任务无效');
  ensure(templates.some(t => t.templateId === value.templateId), '任务引用的模板不存在');
  return { instanceId: text(value.instanceId, '任务ID'), templateId: value.templateId, name: text(value.name, '任务名称'), variables: variables(value.variables) };
}
export function resolveSteps(t, vars) {
  ensure(t.steps.length > 0, '本组尚未录制流程，请先人工录制并绑定变量');
  const safeVars = variables(vars);
  const source = [];
  for (let i = 0; i < t.steps.length; i++) {
    const step = t.steps[i];
    if (step.type === 'click' && t.steps[i + 1]?.type === 'navigate') {
      source.push({ ...step, followNavigation: true });
      i++; // The click already navigates; never replay the sample patient's fixed URL.
    } else source.push(step);
  }
  // Backward-compatible default for recorded HIS flows: if a task carries
  // searchWord but an older template kept the sample literal, bind it to the
  // first typed input instead of silently replaying that sample every time.
  if (Object.hasOwn(safeVars, 'searchWord') && !source.some(s => ['input', 'select'].includes(s.type) && /\{searchWord\}/.test(s.value))) {
    const firstInput = source.findIndex(s => s.type === 'input');
    ensure(firstInput >= 0, '任务有搜索值，但模板没有可替换的文本输入步骤');
    source[firstInput] = { ...source[firstInput], value: '{searchWord}' };
  }
  return source.map(s => ['input', 'select'].includes(s.type) ? { ...s, value: interpolate(s.value, safeVars) } : { ...s });
}
export function importData(data) {
  ensure(data?.version === 1 && Array.isArray(data.templates) && Array.isArray(data.tasks), '备份格式无效');
  ensure(data.templates.length <= 100 && data.tasks.length <= 500, '备份超过数量限制');
  const templates = data.templates.map(template);
  ensure(new Set(templates.map(t => t.templateId)).size === templates.length, '模板ID重复');
  const tasks = data.tasks.map(t => task(t, templates));
  ensure(new Set(tasks.map(t => t.instanceId)).size === tasks.length, '任务ID重复');
  return { templates, tasks };
}
export function seed(demo = false) {
  const steps = [
    { type: 'input', selector: '#search-word', value: '{searchWord}' },
    { type: 'click', selector: '#search-form button[type="submit"]' },
    { type: 'wait', selector: '.results-panel table' },
    { type: 'click', selector: '.results-panel a.small-button', followNavigation: true },
  ];
  const templates = ['COD', 'A'].map(groupName => template({ templateId: `demo-${groupName}`, name: `${groupName} 分组流程`, groupName, startUrl: 'http://127.0.0.1:4173/search', steps: demo ? steps : [] }));
  const searchValues = ['林小禾', '周以宁', '许知远', '沈听澜', '顾明溪'];
  const tasks = ['COD1', 'COD2', 'COD3', 'A1', 'A2'].map((name, index) => ({ instanceId: `demo-${name}`, templateId: `demo-${name.startsWith('COD') ? 'COD' : 'A'}`, name, variables: { searchWord: searchValues[index], taskText: DEMO_TASK_BODY } }));
  return { templates, tasks, settings: { externalOrigins: [], targetOrigins: ['http://127.0.0.1:4173'], externalEnabled: false }, runs: [], recording: null, activeRun: null };
}

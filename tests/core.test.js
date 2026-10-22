import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, template, task, resolveSteps, importData, variables, panelPreferences } from '../extension/core.js';
test('COD1/COD2 reuse the same immutable template', () => { const t = seed(true).templates[0]; assert.equal(resolveSteps(t, { searchWord: 'COD2' })[0].value, 'COD2'); assert.equal(t.steps[0].value, '{searchWord}'); });
test('missing variables fail before running', () => assert.throws(() => resolveSteps(seed(true).templates[0], {}), /缺少变量/));
test('variable payload cannot smuggle prototype keys', () => assert.throws(() => variables(JSON.parse('{"__proto__":"bad"}')), /变量名/));
test('variable substitution is literal, not recursive', () => assert.equal(resolveSteps(seed(true).templates[0], { searchWord: '{other}<script>' })[0].value, '{other}<script>'));
test('reject scripts, unbounded waits, cross-origin navigation', () => { const t = seed(true).templates[0]; for (const step of [{ type: 'eval', value: 'x' }, { type: 'click', selector: '#x', timeout: 300000 }, { type: 'navigate', url: 'https://evil.example/' }]) assert.throws(() => template({ ...t, steps: [step] })); assert.throws(() => template({ ...t, startUrl: 'javascript:alert(1)' })); });
test('backup validation prevents orphan tasks and duplicate identifiers', () => { const s = seed(true); assert.deepEqual(importData({ version: 1, ...s }).tasks.map(t => t.instanceId), s.tasks.map(t => t.instanceId)); assert.throws(() => importData({ version: 1, templates: [], tasks: s.tasks })); assert.throws(() => importData({ version: 1, templates: [s.templates[0], s.templates[0]], tasks: [] })); });

test('unrecorded group cannot execute; task names differ from search values', () => { const s = seed(); assert.equal(s.tasks[0].name, 'COD1'); assert.equal(s.tasks[0].variables.searchWord, '林小禾'); assert.throws(() => resolveSteps(s.templates[0], {searchWord:'林小禾'}), /尚未录制/); });
test('task正文按任务本地保存并限制长度', () => { const s = seed(); const saved = task({ ...s.tasks[0], variables: { searchWord: '林小禾', taskText: 'COD1专属正文' } }, s.templates); assert.equal(saved.variables.taskText, 'COD1专属正文'); assert.throws(() => task({ ...s.tasks[0], variables: { taskText: 'x'.repeat(4001) } }, s.templates), /4000字/); });
test('COD sample tasks cover all twelve patients with distinct handling text', () => {
  const cod = seed().tasks.filter(item => item.templateId === 'demo-COD');
  assert.equal(cod.length, 12);
  assert.equal(new Set(cod.map(item => item.variables.patientId)).size, 12);
  assert.equal(new Set(cod.map(item => item.variables.taskText)).size, 12);
  assert.deepEqual(cod.map(item => item.name), Array.from({ length: 12 }, (_, i) => `COD${i + 1}`));
  assert.ok(cod.every(item => item.variables.taskText.includes('处理意见')));
});

test('wait checkpoint can require expected visible text', () => { const base = seed(true).templates[0]; const saved = template({ ...base, steps: [{ type: 'wait', selector: '#saved', expectedText: '保存成功', label: '确认保存结果' }] }); assert.equal(saved.steps[0].expectedText, '保存成功'); assert.throws(() => template({ ...base, steps: [{ type: 'wait', selector: '#saved', expectedText: 'x'.repeat(4001) }] }), /成功标志文本无效/); });
test('floating panel preferences preserve open state and position safely', () => { assert.deepEqual(panelPreferences({ open: true, left: 42, top: 75 }), { open: true, left: 42, top: 75 }); assert.deepEqual(panelPreferences({ open: 'yes', left: -4, top: Infinity }), { open: false, left: null, top: null }); });

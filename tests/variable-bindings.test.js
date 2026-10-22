import test from 'node:test';
import assert from 'node:assert/strict';
import { configureBindings, resolveSteps, resolveSingleStep, patientVariableForSelector, reorderStep, removeStep, describeStep } from '../extension/core.js';

test('visual step editor describes steps in Chinese and preserves labels', async () => {
  const value = { templateId: 'visual', name: '流程', groupName: 'A', startUrl: 'http://127.0.0.1:4174/', steps: [
    { type: 'click', selector: 'a:nth-of-type(3)', label: '预约登记' },
    { type: 'click', selector: 'a:nth-of-type(3)' },
    { type: 'input', selector: 'input[name="patientId"]', value: '{patientId}' },
    { type: 'paste', selector: 'textarea[name="history"]' },
  ] };
  assert.equal(describeStep(value.steps[0]), '点击预约登记');
  assert.equal(describeStep(value.steps[1]), '点击预约登记');
  assert.equal(describeStep(value.steps[2]), '填写患者编号');
  assert.equal(describeStep(value.steps[3]), '粘贴任务正文');
  assert.equal((await import('../extension/core.js')).template(value).steps[0].label, '预约登记');
});

test('moving and deleting steps keeps variable bindings attached to their actions', () => {
  const value = { templateId: 'visual', name: '流程', groupName: 'A', startUrl: 'http://127.0.0.1:4174/', steps: [
    { type: 'input', selector: 'input[name="patientId"]', value: '{patientId}' },
    { type: 'click', selector: 'button[type=submit]' },
    { type: 'input', selector: 'input[name="patientName"]', value: '{patientName}' },
  ], bindings: [{ stepIndex: 0, variable: 'patientId' }, { stepIndex: 2, variable: 'patientName' }], bindingsConfigured: true };
  const moved = reorderStep(value, 2, -1);
  assert.deepEqual(moved.steps.map(step => step.type), ['input', 'input', 'click']);
  assert.deepEqual(moved.bindings, [{ stepIndex: 0, variable: 'patientId' }, { stepIndex: 1, variable: 'patientName' }]);
  const removed = removeStep(moved, 0);
  assert.deepEqual(removed.steps.map(step => step.type), ['input', 'click']);
  assert.deepEqual(removed.bindings, [{ stepIndex: 0, variable: 'patientName' }]);
  assert.deepEqual(removeStep(removed, 20), removed);
});

test('single-step trial resolves only the selected step with its matching task variable', () => {
  const flow = { templateId: 'appointment', name: '预约登记', groupName: 'A', startUrl: 'http://127.0.0.1:4174/', bindingsConfigured: true, steps: [
    { type: 'click', selector: 'a:nth-of-type(3)' },
    { type: 'input', selector: 'input[name="patientId"]', value: '{patientId}' },
    { type: 'input', selector: 'input[name="patientName"]', value: '{patientName}' },
  ], bindings: [{ stepIndex: 1, variable: 'patientId' }, { stepIndex: 2, variable: 'patientName' }] };
  assert.deepEqual(resolveSingleStep(flow, 1, { patientId: 'DEMO-1004', patientName: '沈听澜' }), { ...flow.steps[1], value: 'DEMO-1004' });
  assert.deepEqual(resolveSingleStep(flow, 2, { patientId: 'DEMO-1004', patientName: '沈听澜' }), { ...flow.steps[2], value: '沈听澜' });
  assert.throws(() => resolveSingleStep(flow, 3, {}), /步骤不存在/);
});

test('appointment patient ID and name fields use separate variables', () => {
  assert.equal(patientVariableForSelector('input[name="patientId"]'), 'patientId');
  assert.equal(patientVariableForSelector('input[name="patientName"]'), 'patientName');
  assert.equal(patientVariableForSelector('#search-word'), 'searchWord');
  assert.equal(patientVariableForSelector('select[name="time"]'), '');
  const flow = { templateId: 'appointment', name: '预约登记', groupName: 'A', startUrl: 'http://127.0.0.1:4174/', steps: [
    { type: 'input', selector: 'input[name="patientId"]', value: '录制编号' },
    { type: 'input', selector: 'input[name="patientName"]', value: '录制姓名' },
    { type: 'select', selector: 'select[name="time"]', value: '10:00' },
  ], bindings: [] };
  const vars = { patientId: 'DEMO-1004', patientName: '沈听澜', searchWord: '沈听澜' };
  assert.deepEqual(resolveSteps(flow, vars).map(step => step.value), ['DEMO-1004', '沈听澜', '10:00']);
  const configured = configureBindings(flow, [{ stepIndex: 0, variable: 'patientId' }, { stepIndex: 1, variable: 'patientName' }]);
  assert.deepEqual(resolveSteps(configured, vars).map(step => step.value), ['DEMO-1004', '沈听澜', '10:00']);
});

const recorded = () => ({ templateId: 'repeat-search', name: '重复查询', groupName: 'COD', startUrl: 'http://127.0.0.1:4174/search', steps: [
  { type: 'input', selector: '#search-word', value: '{searchWord}' },
  { type: 'input', selector: '#search-word', value: '{searchWord}' },
  { type: 'paste', selector: 'textarea[name=plan]' },
], bindings: [{ stepIndex: 0, variable: 'searchWord' }, { stepIndex: 1, variable: 'searchWord' }] });

test('removing one binding and renaming another keeps only the selected steps', () => {
  const original = recorded();
  const configured = configureBindings(original, [{ stepIndex: 1, variable: 'searchWord1' }, { stepIndex: 2, variable: 'taskText' }]);
  const steps = resolveSteps(configured, { searchWord1: '林小禾', taskText: '本次处理意见' });
  assert.equal(configured.steps[0].disabled, true);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].value, '林小禾');
  assert.equal(steps[1].clipboardVariable, 'taskText');
  assert.equal(original.steps[0].value, '{searchWord}');
});

test('multiple recorded steps can explicitly share one variable across patients', () => {
  const configured = configureBindings(recorded(), [{ stepIndex: 0, variable: 'patient' }, { stepIndex: 1, variable: 'patient' }, { stepIndex: 2, variable: 'taskText' }]);
  for (const patient of ['林小禾', '周以宁']) assert.deepEqual(resolveSteps(configured, { patient, taskText: '处理意见' }).slice(0, 2).map(step => step.value), [patient, patient]);
});

test('legacy paste playback uses current task text and skips recorded blur echoes without resaving', () => {
  const source = { ...recorded(), bindings: [], steps: [
    { type: 'paste', selector: 'textarea[name=history]' },
    { type: 'click', selector: 'body' },
    { type: 'input', selector: 'textarea[name=history]', value: '录制时的旧正文' },
  ] };
  const steps = resolveSteps(source, { taskText: '当前任务的新正文' });
  assert.deepEqual(steps.map(step => step.type), ['paste', 'click']);
  assert.equal(steps[0].clipboardVariable, 'taskText');
  assert.equal(steps[0].replaceValue, true);
  const configured = { ...source, bindingsConfigured: true, bindings: [{ stepIndex: 0, variable: 'taskText' }] };
  assert.deepEqual(resolveSteps(configured, { taskText: '另一条任务正文' }).map(step => step.type), ['paste', 'click']);
});

test('one taskText binding covers every distinct paste target and disables captured input echoes', () => {
  const source = { ...recorded(), steps: [
    { type: 'paste', selector: 'textarea[name=history]' },
    { type: 'input', selector: 'textarea[name=history]', value: '录制时的正文' },
    { type: 'paste', selector: 'textarea[name=examination]' },
    { type: 'input', selector: 'textarea[name=examination]', value: '录制时的检查内容' },
  ], bindings: [] };
  const configured = configureBindings(source, [{ stepIndex: 0, variable: 'taskText' }]);
  assert.deepEqual(configured.bindings, [{ stepIndex: 0, variable: 'taskText' }, { stepIndex: 2, variable: 'taskText' }]);
  assert.equal(configured.steps[1].disabled, true);
  assert.equal(configured.steps[3].disabled, true);
  const resolved = resolveSteps(configured, { taskText: '本次处理意见' });
  assert.deepEqual(resolved.map(step => step.type), ['paste', 'paste']);
  assert.deepEqual(resolved.map(step => step.clipboardVariable), ['taskText', 'taskText']);
});

test('explicitly keeping the old variable allows separate values for two steps', () => {
  const configured = configureBindings(recorded(), [{ stepIndex: 0, variable: 'searchWord' }, { stepIndex: 1, variable: 'searchWord1' }, { stepIndex: 2, variable: 'taskText' }]);
  assert.deepEqual(resolveSteps(configured, { searchWord: '甲', searchWord1: '乙', taskText: '正文' }).slice(0, 2).map(step => step.value), ['甲', '乙']);
});

test('reducing four variables to two persists through schema validation', async () => {
  const { template } = await import('../extension/core.js');
  const source = recorded();
  source.steps.push({ type: 'input', selector: 'input[name=id]', value: '{patientId}' }, { type: 'input', selector: 'input[name=age]', value: '{age}' }, { type: 'input', selector: 'textarea[name=plan]', value: '录制时的旧正文' });
  source.bindings.push({ stepIndex: 3, variable: 'patientId' }, { stepIndex: 4, variable: 'age' });
  const saved = template(configureBindings(source, [{ stepIndex: 1, variable: 'searchWord' }, { stepIndex: 2, variable: 'taskText' }]));
  assert.equal(saved.bindingsConfigured, true);
  assert.equal(saved.bindings.length, 2);
  assert.ok([0, 3, 4, 5].every(index => saved.steps[index].disabled));
  assert.deepEqual(resolveSteps(saved, { searchWord: '林小禾', taskText: '新的处理意见' }).map(step => step.type), ['input', 'paste']);
  assert.equal(resolveSteps(saved, { searchWord: '林小禾', taskText: '新的处理意见' })[1].replaceValue, true);
  const empty = template(configureBindings(saved, []));
  assert.equal(empty.bindings.length, 0);
  assert.equal(resolveSteps(empty, {}).length, 0);
});

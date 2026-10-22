import { DEMO_PATIENTS } from '/demo-patients.js';
const patients = DEMO_PATIENTS.map(({ id, name, sex, age, department, phone }) => ({ id, name, sex, age, dept: department, phone, tag: '演示患者' }));
const app = document.querySelector('#app');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const stored = key => { try { return JSON.parse(localStorage.getItem(`qinghe-${key}`) || '[]'); } catch { return []; } };
const save = (key, value) => localStorage.setItem(`qinghe-${key}`, JSON.stringify(value));
function alignLegacyPatientRecords() {
  const remapped = new Map();
  const localPatients = stored('new-patients');
  const retained = localPatients.filter(patient => {
    if (!/^DEMO-20(?:0[1-9]|1[0-2])$/.test(patient.id || '')) return true;
    const current = patients.find(item => item.id === patient.id.replace(/^DEMO-2/, 'DEMO-1'));
    if (!current || current.name !== patient.name || Number(current.age) !== Number(patient.age)) return true;
    remapped.set(patient.id, current);
    return false;
  });
  if (!remapped.size) return;
  save('new-patients', retained);

  let appointmentChanged = false;
  const nextAppointments = stored('appointments').map(item => {
    const current = remapped.get(item.patientId);
    if (!current) return item;
    appointmentChanged = true;
    return { ...item, patientId: current.id, patientName: current.name, department: current.department, phone: current.phone };
  });
  if (appointmentChanged) save('appointments', nextAppointments);

  const notes = noteStore();
  let notesChanged = false;
  for (const [key, note] of Object.entries(notes)) {
    if (!note || typeof note !== 'object') continue;
    const current = remapped.get(note.patientId) || remapped.get(key);
    if (!current) continue;
    note.patientId = current.id;
    notesChanged = true;
  }
  if (notesChanged) localStorage.setItem('qinghe-notes', JSON.stringify(notes));
}
const activePatients = () => {
  const deleted = new Set(stored('deleted-patients'));
  const builtInIds = new Set(patients.map(patient => patient.id));
  const custom = stored('new-patients').filter(patient => !deleted.has(patient.id) && !builtInIds.has(patient.id));
  return [...custom, ...patients.filter(patient => !deleted.has(patient.id))];
};
const appointmentLabels = { booked: '待签到', 'checked-in': '已签到', 'in-consultation': '接诊中', 'awaiting-review': '待复核', completed: '已完成', cancelled: '已取消' };
const appointmentTransitions = { booked: ['checked-in', 'cancelled'], 'checked-in': ['in-consultation'], 'in-consultation': ['awaiting-review'], 'awaiting-review': ['completed'], completed: [], cancelled: [] };
function appointments() {
  let changed = false;
  const rows = stored('appointments').map(item => {
    const at = item.createdAt || new Date().toLocaleString('zh-CN', { hour12: false });
    const status = item.status || 'booked';
    if (item.appointmentId && item.status && Array.isArray(item.events)) return item;
    changed = true;
    return { ...item, appointmentId: item.appointmentId || crypto.randomUUID(), status, createdAt: at, updatedAt: item.updatedAt || at, events: Array.isArray(item.events) ? item.events : [{ status, at, actor: '历史预约迁移' }] };
  });
  if (changed) save('appointments', rows);
  return rows;
}
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function transitionAppointment(id, nextStatus, actor = '门诊工作站') {
  const rows = appointments();
  const item = rows.find(appointment => appointment.appointmentId === id);
  if (!item) return { ok: false, error: '预约记录不存在，请刷新后重试' };
  const currentStatus = item.status || 'booked';
  if (!appointmentTransitions[currentStatus]?.includes(nextStatus)) return { ok: false, error: `当前状态“${appointmentLabels[currentStatus] || currentStatus}”不能转为“${appointmentLabels[nextStatus]}”` };
  const at = new Date().toLocaleString('zh-CN', { hour12: false });
  item.status = nextStatus; item.updatedAt = at;
  item.events = [...(item.events || []), { status: nextStatus, at, actor }];
  save('appointments', rows);
  return { ok: true, item };
}
const noteStore = () => { try { const value = JSON.parse(localStorage.getItem('qinghe-notes') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } };
alignLegacyPatientRecords();
const nav = location.pathname;
const active = nav === '/search' || nav.startsWith('/patient/') ? 'search' : nav.slice(1) || 'home';
const shell = body => {
  app.classList.toggle('reports-page', nav === '/reports');
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === active));
  app.innerHTML = body;
};
const heading = (eyebrow, title, desc) => `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div></div>`;
const patientRows = (items, action = '查看病历', showDelete = false) => items.length ? `<div class="table-wrap"><table><thead><tr><th>患者</th><th>患者编号</th><th>性别 / 年龄</th><th>科室</th><th></th></tr></thead><tbody>${items.map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.tag || '演示患者')}</small></td><td>${escapeHtml(p.id)}</td><td>${escapeHtml(p.sex)} / ${escapeHtml(p.age)}岁</td><td>${escapeHtml(p.dept)}</td><td class="patient-actions">${action ? `<a class="small-button" href="/patient/${encodeURIComponent(p.id)}">${action} →</a>` : ''}${showDelete ? `<button class="small-button delete-patient" type="button" data-patient-id="${escapeHtml(p.id)}">删除</button>` : !action ? '<span class="muted">请用完整姓名或编号缩小范围</span>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">没有匹配的演示患者。可在“患者档案”中新建一条虚构记录。</div>';
function renderHome() {
  shell(`${heading('LOCAL HIS SANDBOX', '青禾医院 · 演示工作台', '用于练习浏览器操作录制与变量回放。所有记录均为虚构，并保存在本机浏览器。')}
    <div class="notice"><span class="notice-icon">i</span><div><strong>安全演示环境</strong><p>不是医院业务系统，不连接内网或真实患者数据。你可以先到患者查询页面练习搜索、选择和打开病历。</p></div><a class="button primary" href="/search">开始患者查询 →</a></div>
    <section class="stats"><article><span>演示患者</span><b>${activePatients().length}</b><small>全部为本地虚构数据</small></article><article><span>待处理预约</span><b>${appointments().filter(item => ['booked', 'checked-in', 'in-consultation', 'awaiting-review'].includes(item.status || 'booked')).length}</b><small>含签到、接诊和复核中状态</small></article><article><span>已保存病历</span><b>${Object.keys(noteStore()).length}</b><small>只保存在当前浏览器</small></article></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">QUICK ACCESS</div><h2>常用功能</h2></div></div><div class="quick-grid"><a href="/search" class="quick-card"><span class="quick-icon">⌕</span><div><strong>患者查询</strong><small>按姓名或编号查找并打开病历</small></div><span>→</span></a><a href="/patients" class="quick-card"><span class="quick-icon">＋</span><div><strong>患者档案</strong><small>查看可用于演示的虚构患者</small></div><span>→</span></a></div></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">SAMPLE RECORDS</div><h2>最近演示患者</h2></div><a href="/patients" class="text-link">查看全部 →</a></div>${patientRows(activePatients().slice(0, 3))}</section>`);
}
function renderSearch(query = '') {
  const all = activePatients();
  const matches = query ? all.filter(p => `${p.name} ${p.id} ${p.dept}`.toLowerCase().includes(query.toLowerCase())) : [];
  shell(`${heading('PATIENT LOOKUP', '患者查询', '输入姓名或患者编号，打开对应的演示病历。试试“林小禾”或“DEMO-1001”。')}
    <form class="panel search-panel" id="search-form"><label for="search-word">姓名 / 患者编号</label><div class="search-row"><input id="search-word" name="searchWord" placeholder="例如：林小禾 或 DEMO-1001" value="${escapeHtml(query)}" autocomplete="off" required><button class="button primary" type="submit">查询患者</button><button class="button secondary" type="button" id="clear-search">清空</button></div><p class="field-hint">录制建议：输入搜索词 → 查询患者 → 点击唯一匹配项 → 进入病历。回放时可替换搜索词变量。</p></form>
    <section class="panel results-panel"><div class="section-title"><div><div class="eyebrow">SEARCH RESULTS</div><h2>${query ? `查询结果 <span class="result-count">${matches.length}</span>` : '等待查询'}</h2></div></div><div id="result-area">${query ? patientRows(matches, '打开病历') : '<div class="empty">请输入姓名或患者编号开始查询。</div>'}</div></section>`);
  document.querySelector('#search-form').addEventListener('submit', e => { e.preventDefault(); const value = document.querySelector('#search-word').value.trim(); history.replaceState({}, '', `/search?q=${encodeURIComponent(value)}`); renderSearch(value); document.querySelector('#search-word').focus(); });
  document.querySelector('#clear-search').addEventListener('click', () => { history.replaceState({}, '', '/search'); renderSearch(); });
}
function renderTasks(query = '') {
  shell(`${heading('PLUGIN TASKS', '任务正文由插件管理', '模拟 HIS 只用于练习患者查询、打开病历和录制目标输入位置。')}
    <section class="panel"><div class="notice"><span class="notice-icon">i</span><div><strong>正文不在模拟 HIS 中</strong><p>请打开浏览器扩展的“任务工作台”，在 COD1 / COD2 等任务卡片中选择“配置”，填写患者姓名或编号和本任务正文。运行时扩展会把本机保存的正文填入录制的粘贴位置。</p></div></div><a class="button primary" href="/search">打开模拟患者查询 →</a></section>`);
}
function renderPatient(id) {
  const directory = activePatients();
  const patientIndex = directory.findIndex(item => item.id === id);
  const p = directory[patientIndex];
  if (!p) { shell(`${heading('PATIENT CHART', '未找到患者', '这条演示档案可能已被删除。') }<a class="button secondary" href="/patients">返回患者档案</a>`); return; }
  const patientLink = (patient, label) => patient
    ? `<a class="button secondary" href="/patient/${encodeURIComponent(patient.id)}" title="${escapeHtml(patient.name)} · ${escapeHtml(patient.id)}">${label}</a>`
    : `<button class="button secondary" type="button" disabled>${label}</button>`;
  const patientNavigation = `<nav class="patient-navigation" aria-label="切换患者">${patientLink(directory[patientIndex - 1], '← 上一个患者')}<span>${patientIndex + 1} / ${directory.length}</span>${patientLink(directory[patientIndex + 1], '下一个患者 →')}</nav>`;
  const appointmentId = new URLSearchParams(location.search).get('appointmentId');
  const linkedAppointment = appointmentId ? appointments().find(item => item.appointmentId === appointmentId) : null;
  const notes = noteStore();
  const noteKey = appointmentId || id;
  const note = notes[noteKey] || {};
  const patientNotes = Object.entries(notes).filter(([key, item]) => key === id || item.patientId === id).map(([key, item]) => ({ ...item, encounterId: item.appointmentId || key })).sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  const bindNoteWorkflow = () => {
    const form = document.querySelector('#note-form');
    if (!form) return;
    const persist = (status, message) => {
      const data = Object.fromEntries(new FormData(form).entries());
      const allNotes = noteStore();
      const previous = allNotes[noteKey] || {};
      const savedAt = new Date().toLocaleString('zh-CN', { hour12: false });
      if (appointmentId && status === 'review') {
        const appointment = appointments().find(item => item.appointmentId === appointmentId);
        if (!appointment || appointment.status !== 'in-consultation') return toast('只有接诊中的预约才能提交病历复核，请先确认预约状态');
        const transition = transitionAppointment(appointmentId, 'awaiting-review', '提交门诊病历');
        if (!transition.ok) return toast(transition.error);
      }
      if (appointmentId && status === 'complete') {
        const appointment = appointments().find(item => item.appointmentId === appointmentId);
        if (!appointment || appointment.status !== 'awaiting-review') return toast('只有待复核的预约才能完成，请核对预约状态');
        const transition = transitionAppointment(appointmentId, 'completed', '复核人确认');
        if (!transition.ok) return toast(transition.error);
      }
      allNotes[noteKey] = { ...previous, ...data, patientId: id, appointmentId: appointmentId || '', workflowStatus: status, savedAt, updatedAt: new Date().toISOString() };
      localStorage.setItem('qinghe-notes', JSON.stringify(allNotes));
      toast(message);
      renderPatient(id);
    };
    document.querySelector('#save-note-draft').addEventListener('click', () => persist('draft', '草稿已保存到本机演示数据'));
    document.querySelector('#submit-note-review').addEventListener('click', () => {
      const values = Object.fromEntries(new FormData(form).entries());
      const missing = ['complaint', 'diagnosis', 'history', 'examination', 'plan'].filter(key => !String(values[key] || '').trim());
      if (missing.length) return toast(`请先补齐必填内容：${missing.join('、')}`);
      if (!values.identityChecked || !values.targetChecked) return toast('请确认演示患者身份和目标记录后再提交复核');
      persist('review', '记录已提交模拟复核');
    });
    document.querySelector('#approve-note-review')?.addEventListener('click', () => {
      const confirmation = document.querySelector('#review-confirmed');
      if (!confirmation.checked) return toast('请先勾选“复核内容与患者匹配”');
      persist('complete', '模拟复核已完成');
    });
  };
  shell(`<div class="crumb"><a href="/search">患者查询</a><span>/</span><span>病历详情</span></div>${heading('PATIENT CHART', '患者病历', '该页面只提供虚构数据与本地表单，用于扩展录制演示。')}
    <section class="patient-banner"><div class="avatar">${escapeHtml(p.name.slice(-1))}</div><div class="patient-name"><div><h2>${escapeHtml(p.name)}</h2><span class="tag">演示数据</span>${linkedAppointment ? `<span class="tag">${escapeHtml(appointmentLabels[linkedAppointment.status] || appointmentLabels.booked)} · ${escapeHtml(linkedAppointment.appointmentId.slice(0, 8))}</span>` : ''}</div><p>${escapeHtml(p.id)}　·　${escapeHtml(p.sex)}　·　${escapeHtml(p.age)}岁　·　${escapeHtml(p.dept)}</p></div><a class="button secondary" href="/search">返回查询</a></section>
    ${patientNavigation}<div class="workflow-steps" aria-label="演示病历流程"><span class="${note.workflowStatus ? 'done' : 'current'}">1. 记录填写</span><i>→</i><span class="${['review', 'complete'].includes(note.workflowStatus) ? 'done' : note.workflowStatus === 'draft' ? 'current' : ''}">2. 身份与内容核对</span><i>→</i><span class="${note.workflowStatus === 'complete' ? 'done' : note.workflowStatus === 'review' ? 'current' : ''}">3. 复核完成</span></div>
    <nav class="tabs" aria-label="病历栏目"><button class="tab active" data-tab="note">就诊记录</button><button class="tab" data-tab="profile">基本信息</button><button class="tab" data-tab="history">历史记录</button></nav>
    <section id="chart-content">${noteForm(p, note)}</section>`);
  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('active', t === tab));
    const content = document.querySelector('#chart-content');
    if (tab.dataset.tab === 'note') { content.innerHTML = noteForm(p, note); bindNoteWorkflow(); }
    if (tab.dataset.tab === 'profile') content.innerHTML = `<section class="panel form-panel"><div class="section-title"><div><div class="eyebrow">PROFILE</div><h2>基本信息</h2></div></div><div class="detail-grid"><div><small>姓名</small><b>${escapeHtml(p.name)}</b></div><div><small>患者编号</small><b>${escapeHtml(p.id)}</b></div><div><small>性别 / 年龄</small><b>${escapeHtml(p.sex)} / ${escapeHtml(p.age)}岁</b></div><div><small>联系电话</small><b>${escapeHtml(p.phone || '未填写')}</b></div><div><small>就诊科室</small><b>${escapeHtml(p.dept)}</b></div><div><small>资料标记</small><b>虚构演示记录</b></div></div></section>`;
    if (tab.dataset.tab === 'history') content.innerHTML = `<section class="panel form-panel"><div class="section-title"><div><div class="eyebrow">VISIT HISTORY</div><h2>历史记录</h2></div><span class="tag">${patientNotes.length} 次就诊</span></div>${patientNotes.length ? patientNotes.map(item => `<article class="history-item"><span class="history-dot"></span><div><b>${escapeHtml(item.savedAt || item.updatedAt || '本地演示记录')}</b><p>${item.diagnosis ? `诊断：${escapeHtml(item.diagnosis)}` : '尚未填写诊断'} · ${escapeHtml(({ draft: '草稿', review: '待复核', complete: '已完成' })[item.workflowStatus] || '未提交')}</p><small>${item.appointmentId ? `预约 ${escapeHtml(item.appointmentId.slice(0, 8))}` : '门诊记录'}${item.department ? ` · ${escapeHtml(item.department)}` : ''}</small></div></article>`).join('') : '<div class="empty">暂无历史门诊记录。</div>'}</section>`;
  }));
  bindNoteWorkflow();
}
function noteForm(p, note) {
  const status = ({ draft: '草稿已保存', review: '待复核', complete: '复核完成' })[note.workflowStatus] || '未保存';
  const fields = `<div class="form-grid"><label>就诊日期<input name="visitDate" type="date" value="${escapeHtml(note.visitDate || localDate())}"></label><label>就诊科室<select name="department"><option>${escapeHtml(note.department || p.dept)}</option><option>全科门诊</option><option>心内科</option><option>消化内科</option><option>呼吸内科</option><option>神经内科</option></select></label><label>主诉<input name="complaint" placeholder="输入本次就诊主诉" value="${escapeHtml(note.complaint || '')}"></label><label>初步诊断<input name="diagnosis" placeholder="输入诊断内容" value="${escapeHtml(note.diagnosis || '')}"></label><label class="wide">现病史<textarea name="history" rows="3" placeholder="输入现病史描述">${escapeHtml(note.history || '')}</textarea></label><label class="wide">检查与体征<textarea name="examination" rows="3" placeholder="输入检查结果或体征">${escapeHtml(note.examination || '')}</textarea></label><label class="wide">处理意见<textarea name="plan" rows="3" placeholder="输入处理意见、宣教或复诊建议">${escapeHtml(note.plan || '')}</textarea></label><label>体温（℃）<input name="temperature" type="number" step="0.1" placeholder="36.5" value="${escapeHtml(note.temperature || '')}"></label><label>血压（mmHg）<input name="bloodPressure" placeholder="120/80" value="${escapeHtml(note.bloodPressure || '')}"></label></div>`;
  const review = note.workflowStatus === 'review' ? `<section class="review-box"><strong>复核队列</strong><p>核对患者标识、正文内容和目标记录后，再完成模拟复核。</p><label class="check-row"><input id="review-confirmed" type="checkbox">复核内容与患者匹配</label><button class="button primary" id="approve-note-review" type="button">完成模拟复核</button></section>` : '';
  const checks = `<section class="review-box"><strong>提交前确认</strong><label class="check-row"><input name="identityChecked" type="checkbox" ${note.identityChecked ? 'checked' : ''}>已核对这是虚构演示患者</label><label class="check-row"><input name="targetChecked" type="checkbox" ${note.targetChecked ? 'checked' : ''}>已确认目标为当前门诊记录</label></section>`;
  return `<form class="panel form-panel" id="note-form"><div class="section-title"><div><div class="eyebrow">OUTPATIENT NOTE · LOCAL WORKFLOW</div><h2>门诊记录</h2></div><span class="tag">${status}</span></div>${fields}${checks}<div class="form-footer"><span>草稿、复核状态仅保存在本机虚构演示数据中。</span><div class="button-row"><button class="button secondary" id="save-note-draft" type="button">保存草稿</button><button class="button primary" id="submit-note-review" type="button">提交复核</button></div></div>${review}</form>`;
}
function renderPatients(query = '') {
  const all = activePatients();
  const matches = query ? all.filter(p => `${p.name} ${p.id} ${p.dept}`.toLowerCase().includes(query.toLowerCase())) : all;
  shell(`${heading('PATIENT DIRECTORY', '患者档案', '先按姓名或患者编号查询，再打开匹配患者的病历。')}
    <form class="panel search-panel" id="directory-search-form"><label for="directory-search">患者姓名 / 患者编号</label><div class="search-row"><input id="directory-search" name="searchWord" placeholder="例如：林小禾 或 DEMO-1001" value="${escapeHtml(query)}" autocomplete="off" required><button class="button primary" type="submit">查询患者</button><button class="button secondary" type="button" id="directory-clear">清空</button></div><p class="field-hint">录制模板时：输入患者姓名或编号 → 查询 → 点击唯一匹配患者的“查看病历”。后续任务只需提供不同的姓名或编号。</p></form>
    <section class="panel results-panel"><div class="section-title"><div><div class="eyebrow">DIRECTORY</div><h2>${query ? `查询结果 <span class="result-count">${matches.length}</span>` : '患者列表'}</h2></div><span class="tag">${query ? `${matches.length} 条匹配` : `${all.length} 条记录`}</span></div>${patientRows(matches, '查看病历', true)}</section>
    <form class="panel form-panel" id="patient-form"><div class="section-title"><div><div class="eyebrow">NEW DEMO PATIENT</div><h2>新建演示患者</h2></div></div><div class="form-grid"><label>患者姓名<input name="name" placeholder="例如：测试患者甲" required></label><label>患者编号<input name="id" placeholder="例如：TEST-2001" required></label><label>性别<select name="sex"><option>女</option><option>男</option><option>其他</option></select></label><label>年龄<input name="age" type="number" min="0" max="120" placeholder="年龄" required></label><label>科室<select name="dept"><option>全科门诊</option><option>心内科</option><option>消化内科</option><option>呼吸内科</option><option>神经内科</option></select></label><label>联系电话<input name="phone" placeholder="可留空，仅虚构信息"></label></div><div class="form-footer"><span>请勿录入真实患者信息。</span><button class="button primary" type="submit">添加虚构患者</button></div></form>`);
  document.querySelector('#directory-search-form').addEventListener('submit', e => { e.preventDefault(); const value = document.querySelector('#directory-search').value.trim(); history.replaceState({}, '', `/patients?q=${encodeURIComponent(value)}`); renderPatients(value); document.querySelector('#directory-search').focus(); });
  document.querySelector('#directory-clear').addEventListener('click', () => { history.replaceState({}, '', '/patients'); renderPatients(); });
  document.querySelectorAll('.delete-patient').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.patientId;
    const patient = all.find(item => item.id === id);
    const linkedAppointments = appointments().filter(item => item.patientId === id);
    const openAppointments = linkedAppointments.filter(item => !['completed', 'cancelled'].includes(item.status));
    if (openAppointments.length) return toast(`该患者还有 ${openAppointments.length} 条未结束预约，请先完成或取消流程`);
    if (!confirm(`确定从本机演示档案删除 ${patient?.name || id}（${id}）吗？`)) return;
    save('deleted-patients', [...new Set([...stored('deleted-patients'), id])]);
    save('new-patients', stored('new-patients').filter(item => item.id !== id));
    const notes = noteStore();
    Object.entries(notes).forEach(([key, note]) => { if (key === id || note.patientId === id) delete notes[key]; });
    localStorage.setItem('qinghe-notes', JSON.stringify(notes));
    save('appointments', appointments().filter(item => item.patientId !== id));
    renderPatients(query); toast('演示患者及关联病历、预约已删除');
  }));
  document.querySelector('#patient-form').addEventListener('submit', e => { e.preventDefault(); const item = Object.fromEntries(new FormData(e.currentTarget).entries()); const list = stored('new-patients'); if (activePatients().some(p => p.id.toLowerCase() === item.id.trim().toLowerCase())) return toast('患者编号已存在，请换一个编号'); item.name = item.name.trim(); item.id = item.id.trim(); item.tag = '本机新增'; save('new-patients', [item, ...list]); renderPatients(query); toast('虚构患者已添加'); });
}
function renderAppointments() {
  const list = appointments();
  const activeCount = list.filter(item => !['completed', 'cancelled'].includes(item.status)).length;
  const actionMarkup = item => {
    if (item.status === 'booked') return `<div class="appointment-actions"><button class="button primary check-in-appointment" data-id="${escapeHtml(item.appointmentId)}">签到</button><button class="button secondary cancel-appointment" data-id="${escapeHtml(item.appointmentId)}">取消预约</button></div>`;
    if (item.status === 'checked-in') return `<button class="button primary start-consultation" data-id="${escapeHtml(item.appointmentId)}">开始接诊</button>`;
    if (['in-consultation', 'awaiting-review'].includes(item.status)) return `<a class="button primary" href="/patient/${encodeURIComponent(item.patientId)}?appointmentId=${encodeURIComponent(item.appointmentId)}">${item.status === 'awaiting-review' ? '打开复核记录' : '继续接诊'}</a>`;
    if (item.status === 'completed') return `<a class="button secondary" href="/patient/${encodeURIComponent(item.patientId)}?appointmentId=${encodeURIComponent(item.appointmentId)}">查看病历</a>`;
    return '<span class="muted">流程已结束</span>';
  };
  shell(`${heading('APPOINTMENT DESK', '预约与门诊流程', '预约需要关联已建档患者，并按“待签到 → 已签到 → 接诊中 → 待复核 → 已完成”流转。')}
    <section class="stats appointment-stats"><article><span>待处理</span><b>${activeCount}</b><small>尚未完成或取消</small></article><article><span>待复核</span><b>${list.filter(item => item.status === 'awaiting-review').length}</b><small>需要完成病历核对</small></article><article><span>今日预约</span><b>${list.filter(item => item.date === localDate() && item.status !== 'cancelled').length}</b><small>按本机日期统计</small></article></section>
    <form class="panel form-panel" id="appointment-form"><div class="section-title"><div><div class="eyebrow">NEW APPOINTMENT</div><h2>登记预约</h2></div><span class="tag">患者身份需匹配档案</span></div><div class="form-grid"><label>患者编号<input name="patientId" list="patient-id-options" placeholder="输入或选择患者编号" required><datalist id="patient-id-options">${activePatients().map(patient => `<option value="${escapeHtml(patient.id)}" label="${escapeHtml(patient.name)}"></option>`).join('')}</datalist></label><label>患者姓名<input name="patientName" placeholder="根据患者档案自动核对" required></label><label>预约日期<input name="date" type="date" min="${localDate()}" value="${localDate()}" required></label><label>预约时间<select name="time"><option value="09:00">09:00</option><option value="09:30">09:30</option><option value="10:00">10:00</option><option value="10:30">10:30</option><option value="14:00">14:00</option><option value="14:30">14:30</option><option value="15:00">15:00</option></select></label><label>就诊科室<select name="department"><option>全科门诊</option><option>心内科</option><option>消化内科</option><option>呼吸内科</option><option>神经内科</option></select></label><label>联系电话<input name="phone" placeholder="可选，仅虚构号码"></label><label class="wide">预约备注<textarea name="memo" rows="2" maxlength="300" placeholder="最多300字"></textarea></label></div><div class="form-footer"><span>保存到本机的虚构演示数据；同一患者同一时段不能重复预约。</span><button class="button primary" type="submit">确认预约</button></div></form>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">SCHEDULE & WORKFLOW</div><h2>预约队列</h2></div><span class="tag">${list.length} 条 · ${activeCount} 条待处理</span></div>${list.length ? `<div class="appointment-list">${list.map(item => `<article class="appointment"><div class="date-badge"><b>${escapeHtml(String(item.date || '').slice(-2))}</b><small>${escapeHtml(String(item.date || '').slice(0, 7))}</small></div><div class="appointment-main"><b>${escapeHtml(item.patientName)} <span>${escapeHtml(item.patientId)}</span></b><p>${escapeHtml(item.department)} · ${escapeHtml(item.time)}${item.phone ? ` · ${escapeHtml(item.phone)}` : ''}</p><span class="appointment-status status-${escapeHtml(item.status)}">${escapeHtml(appointmentLabels[item.status] || '待签到')}</span>${item.memo ? `<p class="appointment-memo">${escapeHtml(item.memo)}</p>` : ''}<details class="appointment-audit"><summary>流程记录（${(item.events || []).length}）</summary><ol>${(item.events || []).map(event => `<li><span>${escapeHtml(appointmentLabels[event.status] || event.status)}</span><small>${escapeHtml(event.at)} · ${escapeHtml(event.actor || '门诊工作站')}</small></li>`).join('')}</ol></details></div>${actionMarkup(item)}</article>`).join('')}</div>` : '<div class="empty">暂无预约。选择已建档患者并登记后，预约会出现在这里。</div>'}</section>`);
  const form = document.querySelector('#appointment-form');
  const patientId = form.elements.patientId, patientName = form.elements.patientName, department = form.elements.department, phone = form.elements.phone;
  const syncPatient = () => {
    const patient = activePatients().find(item => item.id.toLowerCase() === patientId.value.trim().toLowerCase());
    if (!patient) return;
    patientName.value = patient.name; department.value = patient.dept; phone.value = patient.phone || '';
  };
  patientId.addEventListener('change', syncPatient);
  patientId.addEventListener('blur', syncPatient);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const item = Object.fromEntries(new FormData(form).entries());
    item.patientId = item.patientId.trim(); item.patientName = item.patientName.trim(); item.memo = item.memo.trim();
    const patient = activePatients().find(candidate => candidate.id.toLowerCase() === item.patientId.toLowerCase());
    if (!patient) return toast('患者编号未建档，请先到“患者档案”创建虚构患者');
    if (patient.name !== item.patientName) return toast('患者姓名与编号不匹配，请重新选择患者编号');
    if (item.date < localDate()) return toast('不能登记早于今天的预约');
    if (item.date === localDate()) {
      const now = new Date(), currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (item.time <= currentTime) return toast('不能预约今天已经过去的时段');
    }
    const existing = appointments().find(appointment => appointment.patientId === item.patientId && appointment.date === item.date && appointment.time === item.time && appointment.status !== 'cancelled');
    if (existing) return toast(`该患者在此时段已有预约（${appointmentLabels[existing.status] || '待签到'}）`);
    const at = new Date().toLocaleString('zh-CN', { hour12: false });
    const appointment = { ...item, appointmentId: crypto.randomUUID(), status: 'booked', createdAt: at, updatedAt: at, events: [{ status: 'booked', at, actor: '预约登记' }] };
    save('appointments', [appointment, ...appointments()]); renderAppointments(); toast('预约已登记，等待患者签到');
  });
  document.querySelectorAll('.check-in-appointment').forEach(button => button.addEventListener('click', () => {
    const item = appointments().find(appointment => appointment.appointmentId === button.dataset.id);
    if (!item) return toast('预约记录不存在，请刷新页面');
    if (item.date !== localDate()) return toast(item.date > localDate() ? '预约日期未到，暂不能签到' : '预约日期已过，请重新登记演示预约');
    const result = transitionAppointment(item.appointmentId, 'checked-in', '前台签到');
    if (!result.ok) return toast(result.error);
    renderAppointments(); toast(`${item.patientName} 已签到，可开始接诊`);
  }));
  document.querySelectorAll('.start-consultation').forEach(button => button.addEventListener('click', () => {
    const result = transitionAppointment(button.dataset.id, 'in-consultation', '门诊医生接诊');
    if (!result.ok) return toast(result.error);
    renderAppointments(); toast('已进入接诊中，可打开患者病历填写门诊记录');
  }));
  document.querySelectorAll('.cancel-appointment').forEach(button => button.addEventListener('click', () => {
    const item = appointments().find(appointment => appointment.appointmentId === button.dataset.id);
    if (!item || !confirm(`确认取消 ${item.patientName} 的预约（${item.date} ${item.time}）？取消后不能恢复。`)) return;
    const result = transitionAppointment(item.appointmentId, 'cancelled', '预约取消');
    if (!result.ok) return toast(result.error);
    renderAppointments(); toast('预约已取消并保留流程记录');
  }));
}
function renderReports() {
  const notes = noteStore(); const noteCount = Object.keys(notes).length; const apptRows = appointments();
  shell(`${heading('DEMO REPORTS', '数据概览', '仅统计此浏览器中自行创建的虚构演示数据。')}
    <section class="stats report-stats"><article><span>演示患者档案</span><b>${activePatients().length}</b><small>种子数据 + 本机新增</small></article><article><span>已保存门诊记录</span><b>${noteCount}</b><small>按患者或预约归档</small></article><article><span>待处理预约</span><b>${apptRows.filter(item => ['booked', 'checked-in', 'in-consultation'].includes(item.status)).length}</b><small>等待签到、接诊或提交病历</small></article><article><span>待复核</span><b>${apptRows.filter(item => item.status === 'awaiting-review').length}</b><small>复核完成后预约闭环</small></article></section>
    <div class="report-details"><section class="panel"><div class="section-title"><div><div class="eyebrow">LOCAL DATA</div><h2>本地数据操作</h2></div></div><p class="muted">可导出演示统计 JSON，或清空本机保存的演示记录（不会影响扩展模板）。</p><div class="button-row"><button class="button primary" id="export-report">导出演示统计 JSON</button><button class="button danger" id="clear-demo">清空演示记录</button></div></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">PRIVACY</div><h2>隐私与数据说明</h2></div></div><p class="muted">本站使用固定虚构患者示例。你新增的患者、预约和病历仅保存在浏览器 localStorage；页面不会发送网络请求。不要输入真实患者的姓名、病历或身份信息。</p></section></div>`);
  document.querySelector('#export-report').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ fakeDataOnly: true, patients: activePatients().length, notes: noteCount, appointments: Object.fromEntries(Object.keys(appointmentLabels).map(status => [status, apptRows.filter(item => item.status === status).length])) }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'qinghe-demo-report.json'; link.click(); URL.revokeObjectURL(link.href); });
  document.querySelector('#clear-demo').addEventListener('click', () => { if (!confirm('确定清空本机新增的虚构患者、预约和病历，并恢复已删除的内置演示患者吗？')) return; ['new-patients', 'deleted-patients', 'appointments', 'notes'].forEach(key => localStorage.removeItem(`qinghe-${key}`)); renderReports(); toast('演示数据已重置'); });
}
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); setTimeout(() => el.classList.remove('visible'), 2600); }

document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === active));
if (nav === '/search') renderSearch(new URLSearchParams(location.search).get('q') || '');
else if (nav === '/tasks') renderTasks(new URLSearchParams(location.search).get('q') || '');
else if (nav.startsWith('/patient/')) renderPatient(decodeURIComponent(nav.slice('/patient/'.length)));
else if (nav === '/patients') renderPatients(new URLSearchParams(location.search).get('q') || '');
else if (nav === '/appointments') renderAppointments();
else if (nav === '/reports') renderReports();
else renderHome();

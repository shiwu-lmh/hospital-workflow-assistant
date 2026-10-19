const patients = [
  { id: 'DEMO-1001', name: '林小禾', sex: '女', age: 32, dept: '全科门诊', phone: '138****1021', tag: '演示患者' },
  { id: 'DEMO-1002', name: '周以宁', sex: '男', age: 45, dept: '心内科', phone: '139****2056', tag: '演示患者' },
  { id: 'DEMO-1003', name: '许知远', sex: '男', age: 58, dept: '消化内科', phone: '137****3118', tag: '演示患者' },
  { id: 'DEMO-1004', name: '沈听澜', sex: '女', age: 26, dept: '呼吸内科', phone: '136****4480', tag: '演示患者' },
  { id: 'DEMO-1005', name: '顾明溪', sex: '女', age: 71, dept: '神经内科', phone: '135****5093', tag: '演示患者' },
  { id: 'DEMO-1006', name: '唐嘉树', sex: '男', age: 39, dept: '全科门诊', phone: '158****6242', tag: '演示患者' },
];
const app = document.querySelector('#app');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const stored = key => { try { return JSON.parse(localStorage.getItem(`qinghe-${key}`) || '[]'); } catch { return []; } };
const save = (key, value) => localStorage.setItem(`qinghe-${key}`, JSON.stringify(value));
const nav = location.pathname;
const active = nav === '/search' || nav.startsWith('/patient/') ? 'search' : nav.slice(1) || 'home';
const shell = body => {
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === active));
  app.innerHTML = body;
};
const heading = (eyebrow, title, desc) => `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div></div>`;
const patientRows = (items, action = '查看病历') => items.length ? `<div class="table-wrap"><table><thead><tr><th>患者</th><th>患者编号</th><th>性别 / 年龄</th><th>科室</th><th></th></tr></thead><tbody>${items.map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.tag || '演示患者')}</small></td><td>${escapeHtml(p.id)}</td><td>${escapeHtml(p.sex)} / ${escapeHtml(p.age)}岁</td><td>${escapeHtml(p.dept)}</td><td>${action ? `<a class="small-button" href="/patient/${encodeURIComponent(p.id)}">${action} →</a>` : '<span class="muted">请用完整姓名或编号缩小范围</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">没有匹配的演示患者。可在“患者档案”中新建一条虚构记录。</div>';
function renderHome() {
  shell(`${heading('LOCAL HIS SANDBOX', '青禾医院 · 演示工作台', '用于练习浏览器操作录制与变量回放。所有记录均为虚构，并保存在本机浏览器。')}
    <div class="notice"><span class="notice-icon">i</span><div><strong>安全演示环境</strong><p>不是医院业务系统，不连接内网或真实患者数据。你可以先到患者查询页面练习搜索、选择和打开病历。</p></div><a class="button primary" href="/search">开始患者查询 →</a></div>
    <section class="stats"><article><span>演示患者</span><b>${patients.length + stored('new-patients').length}</b><small>全部为本地虚构数据</small></article><article><span>今日预约</span><b>${stored('appointments').length}</b><small>可在预约管理中新增</small></article><article><span>已保存病历</span><b>${Object.keys(JSON.parse(localStorage.getItem('qinghe-notes') || '{}')).length}</b><small>只保存在当前浏览器</small></article></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">QUICK ACCESS</div><h2>常用功能</h2></div></div><div class="quick-grid"><a href="/search" class="quick-card"><span class="quick-icon">⌕</span><div><strong>患者查询</strong><small>按姓名或编号查找并打开病历</small></div><span>→</span></a><a href="/patients" class="quick-card"><span class="quick-icon">＋</span><div><strong>患者档案</strong><small>查看可用于演示的虚构患者</small></div><span>→</span></a></div></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">SAMPLE RECORDS</div><h2>最近演示患者</h2></div><a href="/patients" class="text-link">查看全部 →</a></div>${patientRows(patients.slice(0, 3))}</section>`);
}
function renderSearch(query = '') {
  const all = [...stored('new-patients'), ...patients];
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
  const p = [...stored('new-patients'), ...patients].find(item => item.id === id) || patients[0];
  const notes = JSON.parse(localStorage.getItem('qinghe-notes') || '{}');
  const note = notes[id] || {};
  shell(`<div class="crumb"><a href="/search">患者查询</a><span>/</span><span>病历详情</span></div>${heading('PATIENT CHART', '患者病历', '该页面只提供虚构数据与本地表单，用于扩展录制演示。')}
    <section class="patient-banner"><div class="avatar">${escapeHtml(p.name.slice(-1))}</div><div class="patient-name"><div><h2>${escapeHtml(p.name)}</h2><span class="tag">演示数据</span></div><p>${escapeHtml(p.id)}　·　${escapeHtml(p.sex)}　·　${escapeHtml(p.age)}岁　·　${escapeHtml(p.dept)}</p></div><a class="button secondary" href="/search">返回查询</a></section>
    <nav class="tabs" aria-label="病历栏目"><button class="tab active" data-tab="note">就诊记录</button><button class="tab" data-tab="profile">基本信息</button><button class="tab" data-tab="history">历史记录</button></nav>
    <section id="chart-content">${noteForm(p, note)}</section>`);
  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('active', t === tab));
    const content = document.querySelector('#chart-content');
    if (tab.dataset.tab === 'note') content.innerHTML = noteForm(p, note);
    if (tab.dataset.tab === 'profile') content.innerHTML = `<section class="panel form-panel"><div class="section-title"><div><div class="eyebrow">PROFILE</div><h2>基本信息</h2></div></div><div class="detail-grid"><div><small>姓名</small><b>${escapeHtml(p.name)}</b></div><div><small>患者编号</small><b>${escapeHtml(p.id)}</b></div><div><small>性别 / 年龄</small><b>${escapeHtml(p.sex)} / ${escapeHtml(p.age)}岁</b></div><div><small>联系电话</small><b>${escapeHtml(p.phone || '未填写')}</b></div><div><small>就诊科室</small><b>${escapeHtml(p.dept)}</b></div><div><small>资料标记</small><b>虚构演示记录</b></div></div></section>`;
    if (tab.dataset.tab === 'history') content.innerHTML = `<section class="panel form-panel"><div class="section-title"><div><div class="eyebrow">VISIT HISTORY</div><h2>历史记录</h2></div></div><div class="history-item"><span class="history-dot"></span><div><b>${note.savedAt ? escapeHtml(note.savedAt) : '2026-10-19 09:30'}</b><p>${note.diagnosis ? `诊断：${escapeHtml(note.diagnosis)}` : '演示门诊 · 全科初诊'}</p><small>${note.savedAt ? '本地保存的演示病历' : '虚构历史记录'}</small></div></div></section>`;
  }));
  document.querySelector('#note-form').addEventListener('submit', e => {
    e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget).entries()); const allNotes = JSON.parse(localStorage.getItem('qinghe-notes') || '{}');
    allNotes[id] = { ...data, savedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }; localStorage.setItem('qinghe-notes', JSON.stringify(allNotes)); toast('病历已保存在本机演示数据中');
  });
}
function noteForm(p, note) {
  return `<form class="panel form-panel" id="note-form"><div class="section-title"><div><div class="eyebrow">OUTPATIENT NOTE</div><h2>门诊记录</h2></div><span class="tag">草稿可编辑</span></div><div class="form-grid"><label>就诊日期<input name="visitDate" type="date" value="${escapeHtml(note.visitDate || '2026-10-19')}"></label><label>就诊科室<select name="department"><option>${escapeHtml(p.dept)}</option><option>全科门诊</option><option>心内科</option><option>消化内科</option><option>呼吸内科</option><option>神经内科</option></select></label><label>主诉<input name="complaint" placeholder="输入本次就诊主诉" value="${escapeHtml(note.complaint || '')}"></label><label>初步诊断<input name="diagnosis" placeholder="输入诊断内容" value="${escapeHtml(note.diagnosis || '')}"></label><label class="wide">现病史<textarea name="history" rows="3" placeholder="输入现病史描述">${escapeHtml(note.history || '')}</textarea></label><label class="wide">检查与体征<textarea name="examination" rows="3" placeholder="输入检查结果或体征">${escapeHtml(note.examination || '')}</textarea></label><label class="wide">处理意见<textarea name="plan" rows="3" placeholder="输入处理意见、宣教或复诊建议">${escapeHtml(note.plan || '')}</textarea></label><label>体温（℃）<input name="temperature" type="number" step="0.1" placeholder="36.5" value="${escapeHtml(note.temperature || '')}"></label><label>血压（mmHg）<input name="bloodPressure" placeholder="120/80" value="${escapeHtml(note.bloodPressure || '')}"></label></div><div class="form-footer"><span>保存后仅写入当前浏览器的本地存储。</span><button class="button primary" type="submit">保存门诊记录</button></div></form>`;
}
function renderPatients(query = '') {
  const added = stored('new-patients');
  const all = [...added, ...patients];
  const matches = query ? all.filter(p => `${p.name} ${p.id} ${p.dept}`.toLowerCase().includes(query.toLowerCase())) : all;
  shell(`${heading('PATIENT DIRECTORY', '患者档案', '先按姓名或患者编号查询，再打开匹配患者的病历。')}
    <form class="panel search-panel" id="directory-search-form"><label for="directory-search">患者姓名 / 患者编号</label><div class="search-row"><input id="directory-search" name="searchWord" placeholder="例如：林小禾 或 DEMO-1001" value="${escapeHtml(query)}" autocomplete="off" required><button class="button primary" type="submit">查询患者</button><button class="button secondary" type="button" id="directory-clear">清空</button></div><p class="field-hint">录制模板时：输入患者姓名或编号 → 查询 → 点击唯一匹配患者的“查看病历”。后续任务只需提供不同的姓名或编号。</p></form>
    <section class="panel results-panel"><div class="section-title"><div><div class="eyebrow">DIRECTORY</div><h2>${query ? `查询结果 <span class="result-count">${matches.length}</span>` : '患者列表'}</h2></div><span class="tag">${query ? `${matches.length} 条匹配` : `${all.length} 条记录`}</span></div>${patientRows(matches, matches.length === 1 ? '查看病历' : null)}</section>
    <form class="panel form-panel" id="patient-form"><div class="section-title"><div><div class="eyebrow">NEW DEMO PATIENT</div><h2>新建演示患者</h2></div></div><div class="form-grid"><label>患者姓名<input name="name" placeholder="例如：测试患者甲" required></label><label>患者编号<input name="id" placeholder="例如：TEST-2001" required></label><label>性别<select name="sex"><option>女</option><option>男</option><option>其他</option></select></label><label>年龄<input name="age" type="number" min="0" max="120" placeholder="年龄" required></label><label>科室<select name="dept"><option>全科门诊</option><option>心内科</option><option>消化内科</option><option>呼吸内科</option><option>神经内科</option></select></label><label>联系电话<input name="phone" placeholder="可留空，仅虚构信息"></label></div><div class="form-footer"><span>请勿录入真实患者信息。</span><button class="button primary" type="submit">添加虚构患者</button></div></form>`);
  document.querySelector('#directory-search-form').addEventListener('submit', e => { e.preventDefault(); const value = document.querySelector('#directory-search').value.trim(); history.replaceState({}, '', `/patients?q=${encodeURIComponent(value)}`); renderPatients(value); document.querySelector('#directory-search').focus(); });
  document.querySelector('#directory-clear').addEventListener('click', () => { history.replaceState({}, '', '/patients'); renderPatients(); });
  document.querySelector('#patient-form').addEventListener('submit', e => { e.preventDefault(); const item = Object.fromEntries(new FormData(e.currentTarget).entries()); const list = stored('new-patients'); if ([...patients, ...list].some(p => p.id.toLowerCase() === item.id.trim().toLowerCase())) return toast('患者编号已存在，请换一个编号'); item.name = item.name.trim(); item.id = item.id.trim(); item.tag = '本机新增'; save('new-patients', [item, ...list]); renderPatients(query); toast('虚构患者已添加'); });
}
function renderAppointments() {
  const list = stored('appointments');
  shell(`${heading('APPOINTMENT DESK', '预约管理', '录入、查看和取消虚构预约，用于演示多字段表单操作。')}
    <form class="panel form-panel" id="appointment-form"><div class="section-title"><div><div class="eyebrow">NEW APPOINTMENT</div><h2>新增预约</h2></div></div><div class="form-grid"><label>患者姓名<input name="patientName" placeholder="输入演示患者姓名" required></label><label>患者编号<input name="patientId" placeholder="输入演示患者编号" required></label><label>预约日期<input name="date" type="date" required></label><label>预约时间<select name="time"><option>09:00</option><option>09:30</option><option>10:00</option><option>10:30</option><option>14:00</option><option>14:30</option><option>15:00</option></select></label><label>就诊科室<select name="department"><option>全科门诊</option><option>心内科</option><option>消化内科</option><option>呼吸内科</option><option>神经内科</option></select></label><label>联系电话<input name="phone" placeholder="仅填写虚构号码"></label><label class="wide">备注<textarea name="memo" rows="2" placeholder="输入预约备注"></textarea></label></div><div class="form-footer"><span>预约记录保存在本机浏览器。</span><button class="button primary" type="submit">确认预约</button></div></form>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">SCHEDULE</div><h2>预约列表</h2></div><span class="tag">${list.length} 条</span></div>${list.length ? `<div class="appointment-list">${list.map((a, i) => `<article class="appointment"><div class="date-badge"><b>${escapeHtml(a.date.slice(-2))}</b><small>${escapeHtml(a.date.slice(0, 7))}</small></div><div class="appointment-main"><b>${escapeHtml(a.patientName)} <span>${escapeHtml(a.patientId)}</span></b><p>${escapeHtml(a.department)} · ${escapeHtml(a.time)} ${a.memo ? `· ${escapeHtml(a.memo)}` : ''}</p></div><button class="button secondary remove-appointment" data-index="${i}">取消</button></article>`).join('')}</div>` : '<div class="empty">暂无预约，请使用上方表单新增。</div>'}</section>`);
  document.querySelector('#appointment-form').addEventListener('submit', e => { e.preventDefault(); const item = Object.fromEntries(new FormData(e.currentTarget).entries()); save('appointments', [item, ...stored('appointments')]); renderAppointments(); toast('预约已添加'); });
  document.querySelectorAll('.remove-appointment').forEach(btn => btn.addEventListener('click', () => { const items = stored('appointments'); items.splice(Number(btn.dataset.index), 1); save('appointments', items); renderAppointments(); toast('预约已取消'); }));
}
function renderReports() {
  const notes = JSON.parse(localStorage.getItem('qinghe-notes') || '{}'); const noteCount = Object.keys(notes).length; const apptCount = stored('appointments').length;
  shell(`${heading('DEMO REPORTS', '数据概览', '仅统计此浏览器中自行创建的虚构演示数据。')}
    <section class="stats"><article><span>演示患者档案</span><b>${patients.length + stored('new-patients').length}</b><small>种子数据 + 本机新增</small></article><article><span>已保存门诊记录</span><b>${noteCount}</b><small>按患者编号归档</small></article><article><span>待就诊预约</span><b>${apptCount}</b><small>可在预约管理维护</small></article></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">LOCAL DATA</div><h2>本地数据操作</h2></div></div><p class="muted">可导出演示统计 JSON，或清空本机保存的演示记录（不会影响扩展模板）。</p><div class="button-row"><button class="button primary" id="export-report">导出演示统计 JSON</button><button class="button danger" id="clear-demo">清空演示记录</button></div></section>
    <section class="panel"><div class="section-title"><div><div class="eyebrow">PRIVACY</div><h2>隐私与数据说明</h2></div></div><p class="muted">本站使用固定虚构患者示例。你新增的患者、预约和病历仅保存在浏览器 localStorage；页面不会发送网络请求。不要输入真实患者的姓名、病历或身份信息。</p></section>`);
  document.querySelector('#export-report').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ fakeDataOnly: true, patients: patients.length + stored('new-patients').length, notes: noteCount, appointments: apptCount }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'qinghe-demo-report.json'; link.click(); URL.revokeObjectURL(link.href); });
  document.querySelector('#clear-demo').addEventListener('click', () => { if (!confirm('确定清空本机新增的虚构患者、预约和病历吗？')) return; ['new-patients', 'appointments', 'notes'].forEach(key => localStorage.removeItem(`qinghe-${key}`)); renderReports(); toast('演示记录已清空'); });
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

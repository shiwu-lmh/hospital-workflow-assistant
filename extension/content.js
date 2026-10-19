(() => {
  if (globalThis.__hospitalRpa) return;
  globalThis.__hospitalRpa = true;
  let recording = false, controller = null, sending = Promise.resolve(), pastedTarget = null, selectedTaskId = null;
  const send = async message => { const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || '扩展连接失败'); return r; };
  const host = document.createElement('hospital-rpa');
  host.style.cssText = 'position:fixed!important;top:20px!important;right:22px!important;z-index:2147483647!important;display:block!important';
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `:host{all:initial;font:14px "Microsoft YaHei",sans-serif;color:#183b36}*{box-sizing:border-box}button,input,textarea{font:inherit}button{cursor:pointer;border:1px solid #dce6e1;border-radius:9px;background:#fff;color:#183b36;padding:9px 12px}button:hover{background:#edf5f1}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #cf9b47}.badge{float:right;background:#123f36;color:white;border:0;box-shadow:0 5px 20px #183b3629;font-weight:bold}.panel{clear:both;position:relative;top:10px;width:min(390px,calc(100vw - 44px));border:1px solid #dce6e1;background:#fcfdfb;border-radius:16px;box-shadow:0 16px 50px #102d3430;overflow:hidden}.head{padding:20px;background:#edf4ee}.head h2{font-size:18px;margin:0 0 6px}.sub{font-size:12px;color:#697f76}.body{padding:16px;max-height:72vh;overflow:auto}.group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:18px 0 8px}h3{font-size:11px;letter-spacing:1.5px;margin:0;color:#697f76}.group-record{padding:6px 9px;font-size:10px;white-space:nowrap}.task{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:9px 0;border-bottom:1px solid #e7ede8}.task-name{display:grid;gap:3px;min-width:0}.task-name strong{font-size:13px}.task-name span{font-size:10px;color:#697f76;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.task button{padding:6px 9px;font-size:11px}.doc{margin-top:13px;border:1px solid #e0e7df;border-radius:10px;background:#fff;padding:12px}.doc-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700}.doc-head span{font-size:10px;color:#718276;font-weight:400}.doc textarea{width:100%;height:150px;resize:vertical;margin-top:10px;padding:10px;border:1px solid #e3e8e3;border-radius:7px;background:#fcfcfa;color:#25312b;font-size:11px;line-height:1.7}.copy{width:100%;margin-top:8px;background:#edf4ee!important;color:#174e3c!important;font-size:11px}.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}input{width:100%;margin-top:8px;padding:9px;border:1px solid #dce6e1;border-radius:8px}form{margin-top:16px}.status{font-size:12px;line-height:1.7;color:#63766f;margin-top:12px}.error{color:#ad3b28}[hidden]{display:none!important}`;
  root.append(style);
  const el = (tag, value, parent, cls) => { const n = document.createElement(tag); if (value) n.textContent = value; if (cls) n.className = cls; parent?.append(n); return n; };
  const icon = el('button', '✚ 流程助手', root, 'badge'); icon.setAttribute('aria-expanded', 'false');
  const panel = el('section', '', root, 'panel'); panel.hidden = true; panel.setAttribute('aria-label', '院内流程助手');
  const head = el('div', '', panel, 'head'); el('h2', '院内流程助手', head); el('div', 'LOCAL AUTOMATION / 本地运行', head, 'sub');
  const body = el('div', '', panel, 'body');
  const list = el('div', '', body), tools = el('div', '', body, 'tools');
  const recordButton = el('button', '停止并保存录制', tools); recordButton.hidden = true;
  const cancelRecordButton = el('button', '取消录制', tools); cancelRecordButton.hidden = true;
  const stopButton = el('button', '停止任务', tools), openButton = el('button', '工作台 ↗', tools);
  const status = el('div', '', body, 'status'); status.setAttribute('role', 'status');
  const showError = error => { status.textContent = error.message; status.classList.add('error'); };
  function templateForGroup(state, groupName) {
    const candidates = state.templates.filter(t => t.groupName === groupName);
    if (candidates.length <= 1) return candidates[0] || null;
    const groupTasks = state.tasks.filter(task => candidates.some(t => t.templateId === task.templateId));
    const usedIds = [...new Set(groupTasks.map(task => task.templateId))];
    if (usedIds.length === 1) return candidates.find(t => t.templateId === usedIds[0]) || null;
    const recorded = candidates.filter(t => t.steps?.length);
    return recorded.length === 1 ? recorded[0] : null;
  }
  async function refresh() {
    const { state } = await send({ type: 'STATE' });
    list.replaceChildren();
    const allTasks = [];
    for (const g of [...new Set(state.templates.map(t => t.groupName))]) {
      const groupHead = el('div', '', list, 'group-head'); el('h3', `${g} / 任务组`, groupHead);
      const groupTemplate = templateForGroup(state, g);
      const groupRecord = el('button', state.recording?.groupName === g ? `录制中 · ${g}` : groupTemplate?.steps?.length ? `重录 ${g} 流程` : `录制 ${g} 流程`, groupHead, 'group-record');
      groupRecord.disabled = !!state.recording || !!state.activeRun || !groupTemplate;
      groupRecord.title = groupTemplate ? `录制后将更新 ${g} 组共用模板` : '请先在工作台为此分组创建唯一模板';
      groupRecord.onclick = async () => {
        try {
          await send({ type: 'RECORD_START', templateId: groupTemplate.templateId, name: groupTemplate.name || `${g}分组流程`, groupName: g });
          await refresh();
          status.textContent = `正在录制 ${g} 共用流程。完成后点“保存录制”；${g}组任务会一起使用这套步骤。`;
        } catch (error) { showError(error); }
      };
      const tasks = state.tasks.filter(task => state.templates.some(t => t.templateId === task.templateId && t.groupName === g));
      if (!tasks.length) el('div', '在工作台为模板添加任务和变量', list, 'sub');
      for (const task of tasks) {
        allTasks.push(task);
        const row = el('div', '', list, 'task'); const info = el('div', '', row, 'task-name'); el('strong', task.name, info); el('span', `患者：${task.variables.searchWord || '未配置'}`, info);
        const inspect = el('button', selectedTaskId === task.instanceId ? '正文 ✓' : '正文', row); inspect.onclick = () => { selectedTaskId = task.instanceId; refresh().catch(showError); };
        const copy = el('button', '复制', row); copy.disabled = !task.variables.taskText; copy.onclick = async () => { try { await navigator.clipboard.writeText(task.variables.taskText); status.textContent = `${task.name} 正文已复制`; status.classList.remove('error'); } catch { showError(new Error('复制失败，请检查浏览器剪贴板权限')); } };
        const run = el('button', '运行 →', row); run.disabled = !!state.activeRun || !!state.recording;
        run.onclick = () => send({ type: 'RUN', instanceId: task.instanceId }).then(refresh).catch(showError);
      }
    }
    if (allTasks.length) {
      const selected = allTasks.find(task => task.instanceId === selectedTaskId) || allTasks[0]; selectedTaskId = selected.instanceId;
      const doc = el('section', '', list, 'doc'); const docHead = el('div', '', doc, 'doc-head'); el('div', `${selected.name} · 模拟任务正文`, docHead); el('span', '本机示例', docHead);
      const text = el('textarea', '', doc); text.value = selected.variables.taskText || ''; text.readOnly = true; text.setAttribute('aria-label', `${selected.name}模拟任务正文`);
      const copy = el('button', '复制这段正文', doc, 'copy'); copy.disabled = !text.value; copy.onclick = async () => { try { await navigator.clipboard.writeText(text.value); status.textContent = `${selected.name} 正文已复制，可在录制时粘贴，或通过运行任务自动填入`; status.classList.remove('error'); } catch { showError(new Error('复制失败，请检查浏览器剪贴板权限')); } };
    }
    recordButton.hidden = !state.recording;
    recordButton.textContent = state.recording ? `停止并保存 ${state.recording.groupName} 流程` : '停止并保存录制';
    recordButton.disabled = !!state.recording && !state.recording.count;
    cancelRecordButton.hidden = !state.recording;
    stopButton.disabled = !state.activeRun;
    if (!status.classList.contains('error')) status.textContent = state.recording ? `正在录制 · 已捕获 ${state.recording.count} 步\n仅录制 HIS 页面操作；悬浮窗内的查看、复制和按钮操作不会录入模板。` : state.activeRun ? '任务执行中…' : state.runs[0] ? `最近执行：${state.runs[0].name} · ${state.runs[0].status}` : '全部数据保存在本机浏览器';
    return state;
  }
  icon.onclick = () => { panel.hidden = !panel.hidden; icon.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) refresh().catch(showError); };
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; icon.focus(); } });
  openButton.onclick = () => send({ type: 'OPEN' }).catch(showError);
  stopButton.onclick = () => send({ type: 'STOP' }).then(refresh).catch(showError);
  recordButton.onclick = async () => { try { status.classList.remove('error'); const state = await refresh(); if (!state.recording || !state.recording.count) throw new Error('当前没有可保存的录制步骤'); recordButton.disabled = true; await sending; const saved = await send({ type: 'RECORD_STOP' }); await refresh(); status.textContent = saved.boundVariable ? `${state.recording.groupName} 共用流程已保存并关联到本组任务；患者搜索变量已绑定。` : `${state.recording.groupName} 共用流程已保存。`; } catch (e) { showError(e); } finally { recordButton.disabled = false; } };
  cancelRecordButton.onclick = async () => { try { status.classList.remove('error'); cancelRecordButton.disabled = true; await sending; await send({ type: 'RECORD_STOP', discard: true }); await refresh(); status.textContent = '录制已取消，未保存模板。'; } catch (e) { showError(e); } finally { cancelRecordButton.disabled = false; } };
  document.documentElement.append(host);
  function selector(node) {
    return globalThis.HospitalSelector(node);
  }
  function capture(step) { sending = sending.then(() => send({ type: 'RECORD_STEP', step })).catch(e => { showError(e); panel.hidden = false; }); return sending; }
    const ignored = e => !recording || e.composedPath().includes(host) || !(e.target instanceof Element) || e.target.closest('[data-rpa-ignore]') || e.target.matches('input[type=password],input[type=file],[autocomplete=current-password],[autocomplete=new-password]');
  document.addEventListener('click', e => {
    if (ignored(e)) return;
    const n = e.target.closest('button,a,input,label,select,[role=button]') || e.target;
    if (n.matches('input,select,label')) return; // Form values are captured by input/change.
    const a = n.closest('a[href]');
    if (a && a.target !== '_blank' && /^https?:/.test(a.href)) {
      const step = { type: 'click', selector: selector(a), followNavigation: true };
      if (recording && a.origin === location.origin && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        // Persist the dynamic result-link click before a document navigation can tear down this content script.
        const currentUrl = location.href, destination = a.href;
        e.preventDefault();
        capture(step).then(() => { if (location.href === currentUrl) location.assign(destination); });
      } else capture(step);
    }
    else capture({ type: 'click', selector: selector(n) });
  }, true);
  document.addEventListener('hospital-rpa-copy', e => { if (typeof e.detail?.text === 'string') send({ type: 'CAPTURE_CLIPBOARD', text: e.detail.text }).catch(showError); }, true);
  document.addEventListener('copy', e => {
    const target = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ? e.target : document.activeElement;
    let text = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value.slice(target.selectionStart ?? 0, target.selectionEnd ?? target.value.length) : getSelection()?.toString();
    if (!text && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) text = target.value;
    if (typeof text === 'string' && text) send({ type: 'CAPTURE_CLIPBOARD', text }).catch(showError);
  }, true);
  document.addEventListener('input', e => { if (pastedTarget === e.target) { pastedTarget = null; return; } if (!ignored(e) && e.target.matches('input:not([type=checkbox]):not([type=radio]),textarea')) capture({ type: 'input', selector: selector(e.target), value: e.target.value }); }, true);
  document.addEventListener('change', e => {
    if (ignored(e)) return;
    if (e.target.matches('select')) capture({ type: 'select', selector: selector(e.target), value: e.target.value });
    if (e.target.matches('input[type=checkbox],input[type=radio]')) capture({ type: 'check', selector: selector(e.target), checked: e.target.checked });
  }, true);
  document.addEventListener('keydown', e => {
    if (ignored(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { pastedTarget = e.target; capture({ type: 'paste', selector: selector(e.target) }); return; }
    if (['Enter', 'Escape'].includes(e.key)) capture({ type: 'key', selector: selector(e.target), key: e.key });
  }, true);
  let scrollTimer;
  addEventListener('scroll', () => { if (!recording) return; clearTimeout(scrollTimer); scrollTimer = setTimeout(() => capture({ type: 'scroll', x: scrollX, y: scrollY }), 150); }, { passive: true });
  async function element(s, signal) {
    const deadline = Date.now() + s.timeout;
    do {
      if (signal.aborted) throw new Error('执行已停止');
      const matches = document.querySelectorAll(s.selector);
      if (matches.length > 1) throw new Error('选择器匹配多个元素，请在工作台修正');
      const n = matches[0];
      if (n && n.getClientRects().length && !n.disabled && getComputedStyle(n).visibility !== 'hidden') return n;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    throw new Error('等待元素超时，请检查选择器或页面状态');
  }
  async function play(s) {
    controller = new AbortController(); const signal = controller.signal;
    if (s.type === 'scroll') { scrollTo(s.x, s.y); return; }
    const n = await element(s, signal); if (signal.aborted) throw new Error('执行已停止');
    if (n.matches('input[type=password],input[type=file]')) throw new Error('不回放密码或文件字段');
    n.scrollIntoView({ block: 'center' });
    if (s.type === 'click') { setTimeout(() => { if (!signal.aborted) n.click(); }, 0); return; }
    if (s.type === 'wait') return;
    n.focus();
    if (s.type === 'paste') {
      if (!(n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement)) throw new Error('粘贴目标必须是文本输入框');
      const start = n.selectionStart ?? n.value.length, end = n.selectionEnd ?? n.value.length;
      const value = n.value.slice(0, start) + (s.clipboardText || '') + n.value.slice(end);
      const proto = n instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(n, value);
      n.setSelectionRange(start + (s.clipboardText || '').length, start + (s.clipboardText || '').length);
      n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); return;
    }
    if (s.type === 'input' || s.type === 'select') {
      const proto = n instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : n instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setter) throw new Error('此字段不支持赋值'); setter.call(n, s.value);
      if (s.type === 'select' && n.value !== s.value) throw new Error('下拉选项不存在');
      n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (s.type === 'check') { if (n.checked !== s.checked) n.click(); }
    else if (s.type === 'key') { n.dispatchEvent(new KeyboardEvent('keydown', { key: s.key, code: s.key, bubbles: true })); if (s.key === 'Enter' && n.form) n.form.requestSubmit(); n.dispatchEvent(new KeyboardEvent('keyup', { key: s.key, code: s.key, bubbles: true })); }
  }
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    if (m.type === 'PING') reply({ ok: true });
    else if (m.type === 'RECORDING') { recording = m.value; icon.textContent = recording ? '● 正在录制' : '✚ 流程助手'; reply({ ok: true }); }
    else if (m.type === 'CANCEL') { controller?.abort(); reply({ ok: true }); }
    else if (m.type === 'PLAY_STEP') { play(m.step).then(() => reply({ ok: true })).catch(e => reply({ ok: false, error: e.message })); return true; }
  });
  send({ type: 'READY' }).then(r => { recording = r.recording; if (recording) icon.textContent = '● 正在录制'; }).catch(() => {});
  setInterval(() => { if (!panel.hidden) refresh().catch(showError); }, 2000);
})();

// Uses the same compact task layout as the page assistant. Runs in an extension-owned tab.
globalThis.mountFloatingAssistant = function(send) {
  let sending = Promise.resolve(), captureError = null, selectedTaskId = null;
  let renderKey = null;
  const progressByGroup = new Map();
  const host = document.createElement('hospital-rpa');
  host.style.cssText = 'position:fixed!important;top:20px!important;right:22px!important;z-index:2147483647!important;display:block!important';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial;color:#183b36;font:14px/1.45 "Microsoft YaHei",sans-serif;color-scheme:light}
    *{box-sizing:border-box}
    button,input,textarea{font:inherit}
    button{min-height:34px;padding:7px 11px;border:1px solid #dce6e1;border-radius:8px;background:#fff;color:#183b36;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}
    button:hover{border-color:#b7cec0;background:#f1f6f2}
    button:active{transform:translateY(1px)}
    button:disabled{opacity:.5;cursor:not-allowed}
    button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #cf9b47;outline-offset:2px}
    .badge{float:right;min-height:38px;padding:8px 13px;border:0;border-radius:10px;background:#123f36;color:#fff;box-shadow:0 5px 20px #183b3629;font-weight:700;cursor:grab;touch-action:none;user-select:none}
    .badge.dragging{cursor:grabbing}
    .badge:hover{background:#1a5948}
    .panel{clear:both;position:relative;top:12px;display:flex;flex-direction:column;width:min(410px,calc(100vw - 32px));max-height:min(840px,calc(100vh - 82px));overflow:hidden;border:1px solid #dce6e1;border-radius:16px;background:#fcfdfb;box-shadow:0 18px 54px #102d3433;animation:panel-in .18s ease-out}
    .head{flex:none;padding:17px 20px 15px;border-bottom:1px solid #e5ece6;background:linear-gradient(135deg,#edf4ee,#f5f8f3)}
    .head h2{margin:0 0 5px;font-size:18px;letter-spacing:.2px}
    .sub{color:#71847b;font-size:11px;letter-spacing:.35px}
    .body{flex:1;min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain;padding:12px 16px 14px;scrollbar-width:thin;scrollbar-color:#bdcbbf transparent}
    .group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0 5px;padding:5px 0 7px;border-bottom:1px solid #e8eee9}
    .group-progress{margin:8px 0 10px;padding:10px 11px;border:1px solid #dce8de;border-radius:10px;background:#f5f8f3}
    .progress-head{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#254a3e;font-size:11px;font-weight:700}
    .progress-detail{margin-top:4px;color:#71847b;font-size:10px;line-height:1.5}
    .progress-track{height:6px;margin-top:8px;overflow:hidden;border-radius:99px;background:#e3eae2}
    .progress-fill{height:100%;border-radius:inherit;background:#277054;transition:width .2s ease}
    .progress-fill.failed{background:#b64a38}.progress-fill.stopped{background:#a4772c}
    .task-state{display:inline-flex;width:max-content;align-items:center;gap:4px;color:#71847b;font-size:10px}
    .task-state::before{width:6px;height:6px;border-radius:50%;background:#c6d0c8;content:""}
    .task-state.running{color:#176548;font-weight:700}.task-state.running::before{background:#27835f;box-shadow:0 0 0 3px #27835f20}
    .task-state.success{color:#277054}.task-state.success::before{background:#39946a}
    .task-state.failed{color:#ad3b28}.task-state.failed::before{background:#c34b38}
    .task-state.stopped{color:#8a6522}.task-state.stopped::before{background:#b88a35}
    h3{margin:0;color:#71847b;font-size:10px;letter-spacing:1.25px}
    .group-record,.group-run{flex:none;min-height:30px;padding:5px 9px;font-size:10px;white-space:nowrap}
    .group-run{border-color:#d7e6dc;background:#edf5ef;color:#174e3c;font-weight:700}
    .task{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px 7px;align-items:center;padding:9px 2px;border-bottom:1px solid #e9efea;transition:background .15s}
    .task.selected{margin-inline:-6px;padding-inline:8px;border-radius:8px;background:#f1f6f1}
    .task-name{display:grid;gap:3px;min-width:0}
    .task-name strong{overflow:hidden;color:#1d4136;font-size:13px;text-overflow:ellipsis;white-space:nowrap}
    .task-name span{overflow:hidden;color:#73857b;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    .task button{min-height:31px;padding:5px 9px;font-size:10px}
    .task>button:last-child{grid-column:1/-1;width:100%;min-height:32px;background:#fff;font-size:11px}
    .task>button:last-child:hover{border-color:#9ebbaa;background:#edf5ef}
    .doc{margin-top:13px;padding:12px;border:1px solid #dfe8e1;border-radius:10px;background:#fff;box-shadow:0 3px 12px #183b3608}
    .doc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:700}
    .doc-head span{color:#829187;font-size:10px;font-weight:400}
    .doc textarea{display:block;width:100%;height:142px;min-height:100px;resize:vertical;margin-top:9px;padding:10px;border:1px solid #e2e9e3;border-radius:7px;background:#fbfcfa;color:#2b3932;font-size:11px;line-height:1.75}
    .copy{width:100%;margin-top:8px;background:#edf5ef!important;color:#174e3c!important;font-size:11px}
    .copy:hover{border-color:#c8dbce;background:#e4f0e7!important}
    .tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid #e9efea}
    .tools button{font-size:11px}
    input{width:100%;margin-top:8px;padding:9px;border:1px solid #dce6e1;border-radius:8px}
    form{margin-top:16px}
    .status{position:sticky;bottom:-14px;margin:8px -16px -14px;padding:10px 16px;background:#fcfdfb;color:#63766f;font-size:11px;line-height:1.65;white-space:pre-line}
    .status.error{color:#ad3b28}
    [hidden]{display:none!important}
    @keyframes panel-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
    @media(max-width:480px){.panel{width:calc(100vw - 24px);max-height:calc(100vh - 72px);top:9px;right:0}.head{padding:14px 16px 12px}.body{padding:10px 12px 12px}.task{gap:5px}.task button{padding-inline:7px}.status{margin-inline:-12px;padding-inline:12px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
  `;
  root.append(style);
  const el = (tag, value, parent, cls) => { const n = document.createElement(tag); if (value) n.textContent = value; if (cls) n.className = cls; parent?.append(n); return n; };
  const icon = el('button', '✚ 流程助手', root, 'badge'); icon.setAttribute('aria-expanded', 'false'); icon.title = '按住拖动面板；单击展开或收起';
  const panel = el('section', '', root, 'panel'); panel.hidden = true; panel.setAttribute('aria-label', '院内流程助手');
  const head = el('div', '', panel, 'head'); el('h2', '院内流程助手', head); el('div', 'LOCAL AUTOMATION / 本地运行', head, 'sub');
  const body = el('div', '', panel, 'body');
  const list = el('div', '', body), tools = el('div', '', body, 'tools');
  const recordButton = el('button', '停止并保存录制', tools); recordButton.hidden = true;
  const cancelRecordButton = el('button', '取消录制', tools); cancelRecordButton.hidden = true;
  const stopButton = el('button', '停止任务', tools), openButton = el('button', '工作台 ↗', tools);
  const status = el('div', '', body, 'status'); status.setAttribute('role', 'status');
  const showError = error => { status.textContent = error.message; status.dataset.errorCode = error.code || ''; status.classList.add('error'); status.scrollIntoView({ block: 'nearest' }); body.scrollTop = body.scrollHeight; };
  const clearError = code => {
    if (!status.classList.contains('error') || (code && status.dataset.errorCode !== code)) return;
    status.classList.remove('error'); delete status.dataset.errorCode; status.textContent = ''; renderKey = null;
  };
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
    const key = JSON.stringify({ templates: state.templates, tasks: state.tasks, recording: state.recording, activeRun: state.activeRun,
      group: state.groupRun ? { id: state.groupRun.id, status: state.groupRun.status, index: state.groupRun.index, error: state.groupRun.error } : null,
      latest: state.runs[0]?.status, selectedTaskId });
    if (key === renderKey) {
      const run = state.groupRun, progress = run && progressByGroup.get(run.groupName);
      if (progress && run.status === 'running') {
        const step = run.currentStep;
        const fraction = step?.total ? Math.min(1, step.index / step.total) : 0;
        const percent = Math.max(0, Math.min(100, ((run.index + fraction) / Math.max(1, run.total)) * 100));
        progress.querySelector('.progress-detail').textContent = `当前：${run.currentTaskName || '准备任务'}${step ? ` · 第 ${Math.min(step.index + 1, step.total)}/${step.total} 步` : ''}`;
        progress.querySelector('.progress-fill').style.width = `${percent}%`;
        progress.querySelector('[role=progressbar]').setAttribute('aria-valuenow', String(Math.round(percent)));
      }
      return state;
    }
    renderKey = key;
    const scrollTop = body.scrollTop;
    progressByGroup.clear();
    list.replaceChildren();
    const allTasks = [];
    for (const g of [...new Set(state.templates.map(t => t.groupName))]) {
      const tasks = state.tasks.filter(task => state.templates.some(t => t.templateId === task.templateId && t.groupName === g));
      const groupHead = el('div', '', list, 'group-head'); el('h3', `${g} / 任务组`, groupHead);
      const groupTemplate = templateForGroup(state, g);
      const groupRun = state.groupRun?.groupName === g ? state.groupRun : null;
      const runGroup = el('button', '一键运行本组', groupHead, 'group-run');
      runGroup.disabled = !tasks.length || !!state.recording || !!state.activeRun;
      runGroup.title = runGroup.disabled ? '请先结束当前执行或录制' : `按列表顺序运行 ${tasks.length} 条任务；若流程或任务数据未配置，会显示具体原因`;
      runGroup.onclick = () => send({ type: 'RUN_GROUP', groupName: g }).then(refresh).catch(showError);
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
      if (!tasks.length) el('div', '在工作台为模板添加任务和变量', list, 'sub');
      if (groupRun) {
        const progress = el('section', '', list, 'group-progress');
        progressByGroup.set(g, progress);
        const total = Math.max(1, groupRun.total);
        const completed = groupRun.status === 'success' ? groupRun.total : groupRun.index;
        const step = groupRun.currentStep;
        const inTaskFraction = groupRun.status === 'running' && step?.total ? Math.min(1, step.index / step.total) : 0;
        const percent = Math.max(0, Math.min(100, ((completed + inTaskFraction) / total) * 100));
        const headline = groupRun.status === 'running' ? `批量运行中 · 已完成 ${completed}/${groupRun.total}`
          : groupRun.status === 'success' ? `批量运行完成 · ${groupRun.total}/${groupRun.total}`
            : groupRun.status === 'failed' ? `批量运行中断 · 已完成 ${completed}/${groupRun.total}`
              : groupRun.status === 'stopped' ? `批量运行已停止 · 已完成 ${completed}/${groupRun.total}`
                : `批量任务状态 · ${groupRun.status}`;
        el('div', headline, progress, 'progress-head');
        const detail = groupRun.status === 'running'
          ? `当前：${groupRun.currentTaskName || '准备任务'}${step ? ` · 第 ${Math.min(step.index + 1, step.total)}/${step.total} 步` : ''}`
          : groupRun.error ? `中止于：${groupRun.currentTaskName || '当前任务'} · ${groupRun.error}` : '可再次点击“一键运行本组”重新执行';
        el('div', detail, progress, 'progress-detail');
        const track = el('div', '', progress, 'progress-track'); track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', `${g}组批量任务进度`); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100'); track.setAttribute('aria-valuenow', String(Math.round(percent)));
        const fill = el('div', '', track, `progress-fill${groupRun.status === 'failed' ? ' failed' : groupRun.status === 'stopped' ? ' stopped' : ''}`); fill.style.width = `${percent}%`;
      }
      if (!selectedTaskId && tasks.length) selectedTaskId = tasks[0].instanceId;
      for (const task of tasks) {
        allTasks.push(task);
        const taskProgress = groupRun?.tasks?.find(item => item.instanceId === task.instanceId);
        const row = el('div', '', list, `task${task.instanceId === selectedTaskId ? ' selected' : ''}`); const info = el('div', '', row, 'task-name'); el('strong', task.name, info); el('span', `患者：${task.variables.patientName || task.variables.searchWord || '未配置'}${task.variables.patientId ? ` · ${task.variables.patientId}` : ''}`, info);
        if (taskProgress) {
          const labels = { running: '正在运行', success: '已完成', failed: '失败', stopped: '已停止', pending: '待运行' };
          el('span', labels[taskProgress.status] || '待运行', info, `task-state ${taskProgress.status}`);
        }
        const inspect = el('button', selectedTaskId === task.instanceId ? '正文 ✓' : '正文', row); inspect.onclick = () => { selectedTaskId = task.instanceId; refresh().catch(showError); };
        const copy = el('button', '复制', row); copy.disabled = !task.variables.taskText; copy.onclick = async () => { try { await navigator.clipboard.writeText(task.variables.taskText); status.textContent = `${task.name} 正文已复制`; status.classList.remove('error'); } catch { showError(new Error('复制失败，请检查浏览器剪贴板权限')); } };
        const run = el('button', '运行 →', row); run.disabled = !!state.activeRun || !!state.recording;
        run.onclick = () => {
          const template = state.templates.find(item => item.templateId === task.templateId);
          const patient = `${task.variables.patientName || task.variables.searchWord || '未配置'}${task.variables.patientId ? `（${task.variables.patientId}）` : ''}`;
          const content = task.variables.taskText || task.variables.historyText || '无';
          const review = `运行前请核对：\n任务：${task.name}\n患者标识：${patient}\n目标页面：${template?.startUrl || '未配置'}\n待填内容：\n${content}\n\n请确认业务页面患者身份一致、搜索结果唯一且目标字段正确。`;

          send({ type: 'RUN', instanceId: task.instanceId }).then(refresh).catch(showError);
        };
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
    if (!status.classList.contains('error')) status.textContent = state.recording ? `正在录制 · 已捕获 ${state.recording.count} 步\n仅录制 HIS 页面操作；悬浮窗内的查看、复制和按钮操作不会录入模板。` : state.groupRun?.status === 'running' ? `${state.groupRun.groupName} 组运行中 ${Math.min(state.groupRun.index + 1, state.groupRun.total)}/${state.groupRun.total} · ${state.groupRun.currentTaskName || ''}` : state.activeRun ? '任务执行中…' : state.groupRun?.status === 'success' ? `${state.groupRun.groupName} 组已完成：${state.groupRun.total} 条任务` : state.groupRun?.status === 'failed' ? `${state.groupRun.groupName} 组中止：${state.groupRun.currentTaskName || ''} · ${state.groupRun.error || '任务失败'}` : state.groupRun?.status === 'stopped' ? `${state.groupRun.groupName} 组已停止` : state.runs[0] ? `最近执行：${state.runs[0].name} · ${state.runs[0].status}` : '全部数据保存在本机浏览器';
    body.scrollTop = scrollTop;
    return state;
  }
  openButton.onclick = () => send({ type: 'OPEN' }).catch(showError);
  stopButton.onclick = () => send({ type: 'STOP' }).then(refresh).catch(showError);
  recordButton.onclick = async () => { try { status.classList.remove('error'); const state = await refresh(); if (!state.recording || !state.recording.count) throw new Error('当前没有可保存的录制步骤'); recordButton.disabled = true; await sending; if (captureError) throw new Error(`有录制步骤未保存：${captureError}。请重新录制后再保存。`); const saved = await send({ type: 'RECORD_STOP' }); await refresh(); status.textContent = saved.boundVariable ? `${state.recording.groupName} 共用流程已保存并关联到本组任务；患者搜索变量已绑定。` : `${state.recording.groupName} 共用流程已保存。`; } catch (e) { showError(e); } finally { recordButton.disabled = false; } };
  cancelRecordButton.onclick = async () => { try { status.classList.remove('error'); cancelRecordButton.disabled = true; await sending; await send({ type: 'RECORD_STOP', discard: true }); await refresh(); status.textContent = '录制已取消，未保存模板。'; } catch (e) { showError(e); } finally { cancelRecordButton.disabled = false; } };


  style.textContent += '.badge{display:none!important}.panel{top:0!important;width:100%!important;max-height:100vh!important;height:100vh;border:0;border-radius:0;box-shadow:none;animation:none}.head{padding:14px 16px}.body{scrollbar-gutter:stable}';
  host.style.cssText = 'position:fixed!important;inset:0!important;display:block!important;z-index:1!important';
  panel.hidden = false;
  return { host, refresh, showError, clearError, head };
};

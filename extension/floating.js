const notice = document.querySelector('#notice');
const start = document.querySelector('#start');
let pip, ui, rawState, selectedTabId = Number(new URLSearchParams(location.search).get('tabId')) || null;
let availableTabs = [], refreshing = false;
let collapsed = false, nativePort, nativeReady = false, nativeState = null;
function setCollapsed(value) {
  if (!pip || pip.closed) return;
  if (!nativeReady) { showError(new Error('请先运行 scripts/install-floating-ball.ps1 安装桌面悬浮球组件。')); return; }
  nativePort.postMessage({ type: value ? 'collapse' : 'expand' });
}
function updateBall() {
  if (!nativeReady || !rawState) return;
  const group = rawState.groupRun;
  const labels = { success: '完成', failed: '失败', stopped: '已停止' };
  const text = rawState.recording ? '录制中' : group?.status === 'running' ? `${group.index}/${group.taskIds.length}`
    : rawState.activeRun ? '运行中' : labels[group?.status] || '展开';
  nativePort.postMessage({ type: 'status', text });
}
function connectDesktopBall() {
  return new Promise((resolve, reject) => {
    let ready = false;
    const port = chrome.runtime.connectNative('cn.hospital_workflow.floating_ball'); nativePort = port;
    const timer = setTimeout(() => { port.disconnect(); reject(new Error('桌面悬浮球连接超时，请重新运行安装脚本后重试。')); }, 6000);
    port.onMessage.addListener(message => {
      if (message.type === 'ready') { ready = true; nativeReady = true; clearTimeout(timer); resolve(); updateBall(); }
      else if (message.type === 'mode') { collapsed = message.collapsed === true; nativeState = message; }
      else if (message.type === 'error') { clearTimeout(timer); reject(new Error(message.error)); port.disconnect(); }
    });
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      clearTimeout(timer); nativeReady = false; nativePort = null; collapsed = false;
      if (!ready) reject(new Error('桌面悬浮球组件尚未安装或连接失败。请运行 scripts/install-floating-ball.ps1 后重试。' + (error ? ' ' + error.message : '')));
      else if (pip && !pip.closed) showError(new Error('桌面悬浮球已退出，任务面板已恢复显示，可关闭后重新开启。'));
    });
    port.postMessage({ type: 'attach' });
  });
}
const rpc = async message => {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || '扩展后台没有响应');
  return result;
};
const showError = error => { notice.textContent = error.message; notice.className = 'error'; notice.dataset.errorCode = error.code || ''; if (ui) ui.showError(error); };
function clearTargetError() {
  ui?.clearError('TARGET_TAB');
  if (notice.dataset.errorCode === 'TARGET_TAB') { notice.className = ''; notice.textContent = '业务页面已连接，请核对目标后运行。'; delete notice.dataset.errorCode; }
}
function panelState(state) {
  const group = state.groupRun;
  const active = state.runs.find(run => run.id === state.activeRun);
  return { ...state, recording: state.recording ? { ...state.recording, count: state.recording.steps.length } : null,
    groupRun: group ? { ...group, total: group.taskIds.length,
      currentTaskName: state.tasks.find(task => task.instanceId === group.taskIds[group.index])?.name,
      currentStep: active?.groupRunId === group.id ? { index: active.index, total: active.total } : null,
      tasks: group.taskIds.map((instanceId, index) => ({ instanceId, status: group.status === 'success' || index < group.index ? 'success' : index === group.index ? group.status : 'pending' })),
    } : null };
}
function review(message) {
  const tasks = message.type === 'RUN_GROUP'
    ? rawState.tasks.filter(task => rawState.templates.some(t => t.templateId === task.templateId && t.groupName === message.groupName))
    : rawState.tasks.filter(task => task.instanceId === message.instanceId);
  const summaries = tasks.map(task => {
    const template = rawState.templates.find(t => t.templateId === task.templateId);
    return `任务：${task.name}\n患者标识：${task.variables.patientName || task.variables.searchWord || '未配置'}（${task.variables.patientId || '编号未配置'}）\n目标页面：${template?.startUrl || '未配置'}\n待填内容：\n${task.variables.taskText || task.variables.historyText || '无'}`;
  });
  return new Promise(resolve => {
    const doc = pip.document, dialog = doc.createElement('dialog');
    dialog.style.cssText = 'width:calc(100% - 40px);max-height:85vh;box-sizing:border-box;border:1px solid #dce8de;border-radius:12px;padding:16px;color:#193c34;font:13px/1.6 Microsoft YaHei';
    const heading = doc.createElement('h3'); heading.textContent = '运行前核对';
    const target = availableTabs.find(tab => tab.id === message.tabId);
    const details = doc.createElement('pre'); details.textContent = `执行标签页：${target?.title || '未知页面'}\n实际页面地址：${target?.url || '已关闭'}\n\n${summaries.join('\n\n────────\n\n')}`;
    details.style.cssText = 'max-height:55vh;overflow:auto;white-space:pre-wrap;font:12px/1.6 Microsoft YaHei';
    const hint = doc.createElement('p'); hint.textContent = '请核对患者身份、目标页面、待填内容及搜索结果唯一性。';
    const cancel = doc.createElement('button'); cancel.textContent = '取消';
    const confirm = doc.createElement('button'); confirm.textContent = '确认运行';
    for (const button of [cancel, confirm]) button.style.cssText = 'padding:8px 14px;margin-right:8px;border:1px solid #dce8de;border-radius:7px;background:white;color:#193c34';
    cancel.onclick = () => dialog.close(); confirm.onclick = () => dialog.close('confirm');
    dialog.onclose = () => { const accepted = dialog.returnValue === 'confirm'; dialog.remove(); resolve(accepted); };
    dialog.append(heading, details, hint, cancel, confirm); doc.body.append(dialog); dialog.showModal();
  });
}
async function send(message) {
  if (message.type === 'STATE') {
    const result = await rpc(message); rawState = result.state;
    return { ...result, state: panelState(rawState) };
  }
  if (['RUN', 'RUN_GROUP', 'RECORD_START'].includes(message.type)) {
    rawState = (await rpc({ type: 'STATE' })).state;
    await refreshTargets();
    if (!availableTabs.some(tab => tab.id === selectedTabId)) {
      const reason = !availableTabs.length ? '未找到已授权的业务页面。请先打开业务系统；若页面已打开，请在工作台授权该网页来源。' : `发现 ${availableTabs.length} 个已授权页面，请在面板顶部“业务页面”中选择执行目标。`;
      throw Object.assign(new Error(reason), { code: 'TARGET_TAB' });
    }
    clearTargetError();
    message = { ...message, tabId: selectedTabId };
  }
  if (['RUN', 'RUN_GROUP'].includes(message.type) && !await review(message)) return { ok: true };
  if (message.type === 'RECORD_STOP' && !message.discard) {
    const state = (await rpc({ type: 'STATE' })).state;
    if (state.recording) {
      const flush = await chrome.tabs.sendMessage(state.recording.tabId, { type: 'FLUSH_RECORDING' }, { frameId: 0 });
      if (!flush?.ok) throw new Error(flush?.error || '录制页面尚未保存操作，请重试');
    }
  }
  const result = await rpc(message);
  ui?.clearError();
  return result;
}
const picker = document.createElement('select'); picker.setAttribute('aria-label', '业务页面');
picker.style.cssText = 'margin-top:9px;max-width:100%;width:100%;padding:7px;border:1px solid #dce8de;border-radius:7px;background:white;color:#193c34;font:11px Microsoft YaHei';
const targetHint = document.createElement('div'); targetHint.setAttribute('role', 'status');
targetHint.style.cssText = 'margin-top:5px;font:10px/1.5 Microsoft YaHei;color:#71847b;overflow-wrap:anywhere';
picker.onchange = () => { selectedTabId = Number(picker.value) || null; if (selectedTabId) clearTargetError(); refresh().catch(showError); };
async function refreshTargets() {
  availableTabs = (await chrome.tabs.query({})).filter(tab => {
    try { return rawState.settings.targetOrigins.includes(new URL(tab.url).origin); } catch { return false; }
  });
  const valid = availableTabs.some(tab => tab.id === selectedTabId);
  if (!valid) {
    // Keep execution/recording attached to its original tab. Reconnect idle UI only when unique.
    selectedTabId = !rawState.activeRun && !rawState.recording && availableTabs.length === 1 ? availableTabs[0].id : null;
  }
  const key = JSON.stringify(availableTabs.map(tab => [tab.id, tab.title, tab.url]));
  if (picker.dataset.key !== key) {
    picker.dataset.key = key; picker.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = availableTabs.length ? '请选择执行目标页面' : '未找到授权页面，请打开业务系统'; picker.append(placeholder);
    for (const tab of availableTabs) { const option = document.createElement('option'); option.value = tab.id; option.textContent = `${tab.title || '业务页面'} · ${new URL(tab.url).host}`; option.title = tab.url; picker.append(option); }
  }
  picker.value = selectedTabId ? String(selectedTabId) : '';
  const target = availableTabs.find(tab => tab.id === selectedTabId);
  targetHint.textContent = target ? `已连接：${target.url}` : availableTabs.length ? `有 ${availableTabs.length} 个授权页面，请选择执行目标。` : '请打开业务网页；来源未授权时可前往“工作台”设置。';
  if (target) clearTargetError();
}
async function refresh() {
  if (refreshing || !pip || pip.closed) return;
  refreshing = true;
  try {
    const result = await rpc({ type: 'STATE' }); rawState = result.state;
    await refreshTargets();
    await ui.refresh();
    updateBall();
  } catch (error) { showError(error); }
  finally { refreshing = false; }
}
start.onclick = async () => {
  try {
    if (pip && !pip.closed) { if (nativeReady) setCollapsed(false); else pip.focus(); return; }
    if (!window.documentPictureInPicture) throw new Error('当前浏览器不支持文档画中画，请使用支持该功能的 Chrome 或 Edge。');
    pip = await documentPictureInPicture.requestWindow({ width: 410, height: 760, disallowReturnToOpener: true });
    pip.document.title = '院内流程助手';
    pip.document.body.style.cssText = 'margin:0;background:#fcfdfb';
    const stylesheet = pip.document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = chrome.runtime.getURL('floating.css'); pip.document.head.append(stylesheet);
    ui = globalThis.mountFloatingAssistant(send); ui.head.append(picker, targetHint); pip.document.body.append(ui.host);
    const collapseButton = pip.document.createElement('button'); collapseButton.type = 'button'; collapseButton.textContent = '收起';
    collapseButton.title = '收起为悬浮球，任务继续运行'; collapseButton.setAttribute('aria-label', '收起为悬浮球');
    collapseButton.style.cssText = 'position:absolute;right:14px;top:12px;min-height:28px;padding:4px 10px;font-size:11px';
    ui.head.style.position = 'relative'; ui.head.style.paddingRight = '72px'; ui.head.append(collapseButton);
    ui.collapseButton = collapseButton; collapseButton.onclick = () => setCollapsed(true);
    await rpc({ type: 'FLOATING_STATUS', open: true });
    pip.addEventListener('pagehide', () => {
      if (nativePort) nativePort.disconnect();
      rpc({ type: 'FLOATING_STATUS', open: false }).catch(() => {});
      start.textContent = '开启置顶悬浮球'; notice.textContent = '悬浮窗已关闭，点击按钮可重新开启。'; ui = null;
    }, { once: true });
    start.textContent = '定位流程助手'; notice.className = ''; notice.textContent = '悬浮球已置顶，点击球可展开任务面板。请保留本控制标签页，可以返回业务页面继续操作。';
    await refresh();
    await connectDesktopBall();
    if (selectedTabId) await chrome.tabs.update(selectedTabId, { active: true });
  } catch (error) { showError(error); }
};
document.querySelector('#workbench').onclick = () => chrome.runtime.openOptionsPage();
// Reloading the controller also closes its PiP child; clear the prior visibility flag.
rpc({ type: 'FLOATING_STATUS', open: false }).catch(showError);
setInterval(refresh, 800);
chrome.storage.onChanged.addListener(() => refresh());

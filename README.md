# 院内流程助手

## 0.2 需求修正：任务名称和搜索值独立

COD1/COD2/COD3 只是任务名称的例子；名称可以是序号、患者姓名或任意标签，搜索值也可以是任意业务文本。A/B/C 仅为示例。新安装的 COD/A 分组尚未录制，不能直接运行。已有安装请重新录制实际业务流程，并将任务的示例搜索值改为实际值。

正确使用顺序：授权业务来源 → 在任务工作台选择业务标签页 → 人工录制本组流程 → 在网页面板保存录制 → 回工作台绑定变化的输入步骤 → 为每行填写“任务名称 | 搜索值” → 运行对应任务。录制同一组会更新该组模板，保留任务关联。不同组单独录制。

每行按“任务名称 | 搜索值”填写，例如“COD1 | 张三”、“COD2 | 李四”，也可用任何实际需要的值。它们共用一套步骤。录制时人工完成查询、选择结果、进入病历。若 HIS 用固定病人 ID 定位结果，需在实际页面核验回放选择器能选中当前搜索到的人。

可离线安装的 Chrome / Edge Manifest V3 扩展。当前是可验证 MVP，尚未在真实医院 HIS 中验收。

## 选型与改造范围

选取 [Browser Agent Recorder](https://github.com/VelvetAbyss/browser-agent-recorder) 的 MIT 录制组件作为参考基础，固定源码版本 `9e632a32acdd749d8e95ef3d1e701de7fa609183`，原始源码保存在 `vendor/browser-agent-recorder`。

这不是原项目的完整 fork 产品：实际复用并改造的是 `src/shared/selector.ts` 的稳定元素定位策略，落在 `extension/selector.js`。其余为院内场景新增：结构化事件录制、确定性回放、变量模板、任务分组、悬浮面板、来源授权和外部消息入口。没有引入原项目的截图、AI、遥测或运行时依赖。第三方 MIT 声明随扩展打包。

## 安装与演示

1. 在本目录运行 `node scripts/demo-server.js`，保持终端运行。
2. 打开 `chrome://extensions` 或 `edge://extensions`，启用开发者模式，选择“加载已解压的扩展程序”，加载本项目 `extension` 目录。
3. 打开 `http://127.0.0.1:4174/`。先人工录制一遍查询操作，再绑定变量并运行任务。默认不预置可运行流程。
4. 点击扩展工具栏按钮打开工作台，可查看任务、模板、记录和连接设置。

仅演示需要 Node；安装后的扩展运行不需要 Node、不访问外网。准备可直接加载的未压缩文件夹：`powershell -NoProfile -File scripts/package.ps1`，然后在浏览器选择 `dist/unpacked`，不需要解压。

## 录制自己的模板

1. 工作台 → 连接与设置，添加业务来源，例如 `http://his.hospital.local:8080`，保存。
2. 进入对应业务页面，打开右上角悬浮图标 → 录制模板，填名称、分组 COD，开始录制。
3. 人工完成查询操作，点击悬浮面板“保存录制”。
4. 工作台 → 流程模板 → “配置变量并生成任务”，选择搜索输入步骤，变量名 `searchWord`，任务逐行填写“任务名称 | 实际搜索值”。
5. 在任务工作台选择目标业务标签页运行。同一组可包含多个模板；外部按组调用时要求该组只有一个模板，否则必须传 templateId。
6. A 组重复上述流程，使用独立模板。

可通过“高级编辑步骤”增加结果等待步骤，例如 `{"type":"wait","selector":"#result[data-ready=true]","timeout":15000}`。每个关键操作后建议明确等待业务完成标志，避免仅看到按钮点击就误判成功。一个任务可包含多个变量，高级任务配置中填写全部变量。

## 外部下发

本版实现的是**业务网页到扩展**的消息，不是可被服务器直接访问的 Webhook。默认只声明 localhost/127.0.0.1 消息入口，且外部下发默认关闭。部署需同时修改 `manifest.json` 的 `externally_connectable.matches` 并在工作台启用下发、授权实际业务来源。执行发生在发起消息的同一个业务标签页，要求与模板同源。

```js
chrome.runtime.sendMessage(extensionId, {
  type: 'RUN', requestId: crypto.randomUUID(),
  templateGroup: 'COD', vars: { searchWord: 'COD2' }
}, console.log);
// 接收 {ok:true, runId} 仅代表已接受，完成结果需查询：
chrome.runtime.sendMessage(extensionId, {
  type: 'RUN_STATUS', runId
}, console.log);
```

requestId 在最近100条记录内去重，不承诺永久去重。相同来源的网页脚本拥有同等调用权限；生产环境应结合业务系统自身认证。服务端异步下发、不同来源的控制台与 HIS 联动，需要后续接入受控轮询或 Native Messaging，当前未实现。

## 当前边界

- 支持普通 HTTP/HTTPS 顶层 DOM 的点击、输入、下拉框、勾选、滚动、等待、同源整页跳转，以及有限的键盘事件。跨页录制仅支持同一标签页。每个步骤最大等待25秒，最多500步。
- iframe、Shadow DOM 内业务控件、新窗口、多标签流程、SPA 路由导航录制、拖拽、上传、验证码、只接受可信输入事件的控件，尚未支持或验收。浏览器设置页、扩展商店等受保护页面无法注入。Edge 需在目标版本现场验收。
- 停止只阻止后续动作，不能撤销已提交业务。后台重启会标记中断，禁止自动重试可能已经提交的动作；人工核对后重新运行。
- 模板从记录时的 startUrl 开始执行。不要将带敏感参数或一次性令牌的 URL 保存为长期模板。
- 使用 chrome.storage.local，未加密。录制时跳过密码与文件输入；其他输入可能含病人信息，应及时改成变量。执行日志不保存变量值，最多保留100条。导出备份包含模板和任务变量，不包含设置和执行历史。
- 当前目标权限为 HTTP/HTTPS 全站，便于全局显示图标；部署包建议将 manifest 的 host_permissions 和 content_scripts.matches 收窄到医院业务域名。

## 验证

`node --test tests/core.test.js`、`node scripts/check.js`。

`node tests/e2e.js` 用独立临时浏览器配置加载真实扩展。需要 Playwright 与其 Chromium；可用环境变量 `PLAYWRIGHT_MODULE` 指定 Playwright 模块路径。验证演示查询、录制、变量回放、缺参拒绝、外部调用、请求去重、停止、持久化，截图输出 artifacts/workbench.png。测试配置保留在系统临时目录便于排查，不使用个人浏览器配置。

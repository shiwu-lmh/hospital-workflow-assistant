import { DEMO_PATIENTS } from './demo-patients.js';

export const MAX_STEPS = 500;
export function patientVariableForSelector(value) {
  const selector = String(value || '').toLowerCase().replace(/[\s"']/g, '');
  if (/\[name=(?:patientid|id)\]/.test(selector)) return 'patientId';
  if (/\[name=(?:patientname|name)\]/.test(selector)) return 'patientName';
  if (selector.includes('[name=age]')) return 'age';
  if (/search[-_]?word|directory[-_]?search/.test(selector)) return 'searchWord';
  return '';
}
export const DEMO_TASK_BODY = '脉率，xx次/分；体温，xx.x℃；血压xxx/xxx mmHg。如有异常请说明。于xx时xx分，完成给药后2h的12导联心电图检查。如有异常请说明。\n于xx时xx分，完成给药后4h生命体征测量：呼吸频率，xx次/分；脉率，xx次/分；体温，xx.x℃；血压xxx/xxx mmHg。如有异常请说明。\n于xx时xx分，完成给药后6h生命体征测量：呼吸频率，xx次/分；脉率，xx次/分；体温，xx.x℃；血压xxx/xxx mmHg。如有异常请说明。于xx时xx分，完成给药后6h的12导联心电图检查。';
// Exact prior defaults let upgrades refresh untouched examples while preserving user edits.
export const LEGACY_DEMO_TASK_BODIES = {
  COD1: '【门诊随访｜演示记录】\n患者标识：DEMO-1001（虚构）\n随访主题：近期睡眠与日常活动情况\n主观反馈：睡眠时长【待填写】小时；夜间醒来【待填写】次；白天活动情况【待填写】。\n记录备注：以上字段仅供界面演示，请勿用于真实诊疗。',
  COD2: '【心内科｜检查记录草稿】\n模拟编号：DEMO-1002\n检查项目：12 导联心电图（演示占位）\n检查时间：____年__月__日 __:__\n结果摘要：________________\n复核状态：□待复核　□已复核\n本内容为虚构样例，不代表检查结果或医疗建议。',
  COD3: '消化内科复诊记录（模拟）\n一、患者自述：________________\n二、饮食与作息变化：________________\n三、本次沟通要点：________________\n四、后续记录：待授权人员补充\n\n仅用于演示正文复制与粘贴流程。',
  A1: '【呼吸专科｜结构化观察单】\n演示对象：DEMO-1004（虚构）\n观察时段：上午 / 下午 / 夜间（选择一项）\n咳嗽情况：________　痰液描述：________\n呼吸频率：____ 次/分　体温：____ ℃\n补充说明：________________\n演示占位文本；请勿作为真实病历内容。',
  A2: '工作流备注 · 模拟任务 A2\n• 资料核对：□完成 □待处理\n• 目标区域：复诊沟通记录（演示）\n• 需要补充：症状变化、患者关注事项、复核人\n• 当前状态：等待人工填写\n\n此条用于展示与其他任务不同的正文样式，所有内容均为虚构。',
  COD4: '【全科门诊｜复诊摘要】\n演示编号：DEMO-1006\n近期情况：________________\n复诊关注点：睡眠、饮食、日常活动（按演示需要选择）\n本次沟通记录：________________\n仅供本地流程演示。',
  COD5: '预约后门诊记录草稿\n患者编号：DEMO-1007\n预约来源：线上演示预约\n到诊确认：□是 □否\n资料补充：联系方式核验【待填写】；主诉【待填写】\n此草稿为虚构内容，不构成医疗建议。',
  COD6: '【神经内科｜沟通记录占位】\n虚构对象：DEMO-1008\n患者关注事项：________________\n陪同情况：□独自到诊 □家属陪同 □其他\n沟通结论：________________\n复核人：________　日期：________',
  A3: '多字段录入演示 · A3\n对象编号：DEMO-1009\n接诊时段：上午 / 下午\n本次主诉：________________\n检查摘要：________________\n记录人确认：□已核对患者 □已核对目标栏目\n纯属虚构演示。',
  A4: '【消化内科｜复诊跟进表】\n演示编号 DEMO-1010\n饮食情况：________\n近期变化：________\n需补充材料：□检查资料 □既往记录 □其他\n状态：待人工补齐后提交模拟复核。',
  A5: '交接备注 / 模拟任务 A5\n患者：DEMO-1011（虚构）\n当前环节：记录完成，等待复核\n待办：1) 核对患者编号；2) 查看目标记录；3) 确认正文完整。\n演示系统不会连接医院网络。',
  A6: '【资料核验清单｜A6】\n虚构编号：DEMO-1012\n姓名与编号：□匹配 □待核对\n就诊科室：□已确认 □待确认\n目标记录：□门诊记录 □历史记录\n当前处理：等待人工复核。',
};
export const PREVIOUS_DEMO_TASK_BODIES = {
  COD1: '门诊复诊记录（虚构演示）\n主诉：近两周入睡时间延长，偶有夜间醒来，白天精神一般。\n现病史：患者自述近期工作作息不规律，入睡约需30分钟，夜醒1至2次；未记录胸闷、气促等不适。睡眠时长及既往用药信息待本人补充核对。\n检查：一般情况平稳；本次未提供客观检查数据。\n评估：睡眠状况变化，需结合完整病史由接诊人员评估。\n处理记录：已沟通规律作息与记录睡眠情况；按预约复诊。缺失信息需核实后补录。',
  COD2: '心内科复诊记录（虚构演示）\n主诉：间断心悸约一周，今日来诊复查。\n现病史：患者自述发作持续数分钟，可自行缓解；发作时间、诱因及伴随症状尚需进一步询问。既往检查资料由患者携带，待核对。\n检查：模拟心电图报告已上传，报告时间及结论需与检查系统原件核对后录入；本示例不预置检查结果。\n评估：心悸待查，诊断结论以接诊医师核实后填写为准。\n处理记录：已告知保存既往检查资料；完成资料核对后提交复核。',
  COD3: '消化内科复诊记录（虚构演示）\n主诉：餐后上腹部胀满不适，反复约三周。\n现病史：患者自述进食较快或进食较多时较明显，调整饮食后有所减轻；排便情况、体重变化及既往胃肠病史尚待补充。\n检查：腹部查体内容未提供，需由接诊人员根据实际检查补录；既往检查报告待核对。\n评估：餐后上腹部不适，原因待进一步评估。\n处理记录：已记录饮食与症状的关联；补齐查体及既往资料后再提交病历。',
  COD4: '全科慢病复诊记录（虚构演示）\n主诉：复诊并核对近期居家血压记录。\n现病史：患者自述近一周测量记录不完整，已携带部分读数；具体数值、测量时间及测量条件待逐项核验。服药依从情况和不适反应尚待询问。\n检查：本次诊室血压未提供，请测量后录入；不得用示例数值代替。\n评估：慢病随访资料待补齐，由接诊人员结合既往记录评估。\n处理记录：已提醒按统一方式记录测量日期与读数；核对既往方案后完成本次随访记录。',
  COD5: '全科初诊记录（虚构演示）\n主诉：咽部不适、轻微咳嗽两天。\n现病史：患者自述症状较轻，饮水后有所缓解；是否发热、吞咽困难及近期接触史需进一步确认。过敏史和既往用药史尚未核对。\n检查：咽部检查及生命体征待本次接诊后填写。\n评估：上呼吸道相关症状，待查体及问诊完成后由接诊人员记录判断。\n处理记录：先完成过敏史、用药史与体征核对；本示例不预设处方或检查结论。',
  COD6: '神经内科随访记录（虚构演示）\n主诉：复诊随访，反馈近期头痛情况。\n现病史：患者自述过去一周头痛发作两次，较前减少；疼痛部位、持续时间、诱因及缓解方式需与患者再次核对。睡眠和日常活动情况一并记录。\n检查：本次未提供新的检查结果；上次检查日期及报告需从既往病历确认。\n评估：头痛症状随访，疗效与变化需结合原始记录判断。\n处理记录：已更新症状频次；核对既往病历后补充本次评估和复诊安排。',
};
export const DEMO_TASK_BODIES = {
  COD7: '呼吸内科｜处理意见（虚构演示）\n患者：沈听澜，DEMO-1004。\n1. 补充咳嗽起始时间、昼夜变化及痰液描述，核对近期接触史。\n2. 将本次生命体征和肺部查体结果录入对应栏目，未检查的项目保留待补充。\n3. 核对过敏史与既往用药后，交接诊医师复核本次记录及复诊安排。',
  COD8: '神经内科｜处理意见（虚构演示）\n患者：顾明溪，DEMO-1005。\n1. 梳理头晕发作与体位变化的时间关系，补记持续时间和伴随表现。\n2. 对照患者携带的用药清单核对名称与使用情况，资料不一致处标记待确认。\n3. 关联既往检查报告并核验日期，完成信息核对后提交复核。',
  COD9: '全科门诊｜处理意见（虚构演示）\n患者：苏念初，DEMO-1009。\n1. 补记腰背不适与久坐、活动的关系，核实有无外伤及活动受限。\n2. 本次仅补充现病史和已完成的查体记录，保留原诊断及其他已确认内容。\n3. 在修改说明中注明补录原因，核对就诊日期后保存草稿供医师复核。',
  COD10: '消化内科｜处理意见（虚构演示）\n患者：陆清和，DEMO-1010。\n1. 对比本次与上次腹胀情况，补录饮食、排便及症状变化。\n2. 将携带的检查报告按日期整理；报告来源或结论未核实时暂不写入正式结果。\n3. 在复诊记录中注明本次补充资料和待核对事项，交接诊医师确认后续安排。',
  COD11: '全科门诊｜处理意见（虚构演示）\n患者：江望舒，DEMO-1011。\n1. 核对本次携带的既往检查资料名称、日期、机构及完整性。\n2. 仅将确认过的资料补充到既往资料栏目，避免覆盖本次主诉、诊断和原处理意见。\n3. 保存修改原因及补录时间，检查资料与当前患者、就诊记录一致后提交复核。',
  COD12: '全科门诊｜处理意见（虚构演示）\n患者：白知夏，DEMO-1012。\n1. 本次重点补充过敏史核对状态，患者未确认的项目注明待核实。\n2. 记录信息来源及仍需确认的内容，保留原记录和更正原因。\n3. 完成患者身份与目标记录核对后保存草稿，由接诊人员确认后更新最终信息。',
  COD1: '全科门诊｜处理意见（演示）\n1. 已与患者沟通按固定时间作息，并记录每日入睡时间、夜间醒来次数及白天精神状态，供下次复诊比较。\n2. 补充核对近期睡眠时长、既往用药及影响睡眠的生活因素；未核实的信息暂不作为既定病史。\n3. 完成本次记录后按原预约复诊，由接诊人员结合补充资料复核后续安排。\n本条为虚构流程样例，不作为真实诊疗建议。',
  COD2: '心内科｜处理意见（演示）\n1. 请将本次心电图报告日期、检查编号及正式结论与检查系统原件核对后关联到本次就诊；未核对前不录入推测结果。\n2. 补记心悸发作时间、持续时长、诱因和伴随不适，并核对患者携带的既往检查资料。\n3. 资料齐全后提交接诊医师复核；药物或检查安排由医师核对病历后决定，本任务不预设处方。\n本条为虚构流程样例。',
  COD3: '消化内科｜处理意见（演示）\n1. 建议在复诊记录中补充进食时间、食物种类与腹胀发生时间，观察症状是否存在稳定关联。\n2. 核对排便变化、体重变化及既往检查报告；缺少原始报告时标记“待核实”，不要补写推测结论。\n3. 由接诊人员完成查体并复核资料后，再确认本次处理方案及复诊安排。\n本条为虚构流程样例，不作为真实诊疗建议。',
  COD4: '全科慢病随访｜处理意见（演示）\n1. 将居家测量值连同日期、时间及测量条件一并补录；本次诊室测量结果须现场获取，不使用示例数值替代。\n2. 核对当前用药名称、实际使用情况及患者反馈的不适；信息不全时保留“待核对”状态。\n3. 汇总近期记录交接诊医师复核。涉及治疗方案的调整须以医师确认结果为准，并记录复诊计划。\n本条为虚构流程样例。',
  COD5: '全科初诊｜处理意见（演示）\n1. 先补齐体温等生命体征、咽部检查记录、过敏史和既往用药信息，再提交本次病历。\n2. 对尚未询问确认的发热、吞咽情况及接触史标记为待补充，不将空白项自动写成阴性。\n3. 由接诊人员根据核实后的问诊和查体决定后续处置；本任务不自动生成诊断、检查申请或处方。\n本条为虚构流程样例。',
  COD6: '神经内科随访｜处理意见（演示）\n1. 在本次记录中更新头痛发作频次，并补充每次持续时间、部位、诱因及对日常活动的影响。\n2. 调取并核对既往检查日期与正式报告；如本次没有新检查结果，应明确记录“本次未提供”，不复制旧结果冒充新结果。\n3. 完成病历差异核对后提交复核，由接诊人员确认后续随访安排。\n本条为虚构流程样例，不作为真实诊疗建议。',
  A1: '呼吸专科门诊记录（虚构演示）\n主诉：咳嗽伴少量咳痰约五天。\n现病史：患者自述夜间咳嗽较明显，痰液颜色及有无发热、气促需当面核实；近期接触史未填写。\n检查：体温、呼吸频率、血氧及肺部听诊结果待本次接诊后录入，不以空值代替检查结果。\n评估：咳嗽待评估，需结合查体及相关资料判断。\n处理记录：已完成身份核对，等待补录生命体征和查体结果，再保存本次记录。',
  A2: '神经内科复诊记录（虚构演示）\n主诉：近一个月偶有短暂头晕，近期发作频率无明显变化。\n现病史：患者自述多在起身较快时出现，休息后缓解；每次持续时间、是否伴头痛或肢体麻木需进一步确认。既往病史及当前用药清单待核对。\n检查：本次神经系统查体尚未录入；既往影像资料需确认检查日期及报告来源。\n评估：头晕症状，待结合完整病史与查体评估。\n处理记录：补齐症状时间线、用药信息及查体结果后提交复核。',
  A3: '全科病历补充记录（虚构演示）\n主诉：活动后腰背部酸胀约一周。\n现病史：患者自述久坐后较明显，休息后减轻；有无外伤、下肢麻木或活动受限需继续核实。\n查体：腰背部查体和活动情况尚未录入，等待接诊人员检查后补充。\n本次修改：在现有就诊记录中补充症状起始时间、诱因和缓解情况；保留原有已核实内容，不覆盖其他字段。\n保存前核对修改对应的患者和就诊日期。',
  A4: '消化内科复诊补充记录（虚构演示）\n主诉：复诊反馈腹胀情况。\n现病史补充：患者自述调整进食速度后餐后胀满有所减轻，近一周排便情况较前无明显变化；具体频次及饮食记录待核对。\n检查资料：上次检查报告日期和结论尚未从原始报告核实，本次暂不填写推测结果。\n本次修改：仅更新现病史补充内容；诊断和处理意见保留原记录，待接诊人员确认后再修改。\n核对患者、就诊日期及目标病历后保存。',
  A5: '门诊病历修改记录（虚构演示）\n修改原因：补充患者本次复诊携带的既往检查资料信息。\n新增内容：资料名称、检查日期、检查机构及报告是否齐全，均需根据原件逐项填写；当前示例不包含实际检查结论。\n修改范围：仅补充“既往资料”栏，不改动主诉、诊断及其他已确认字段。\n保存前请对照原病历核实患者编号与就诊日期，并确认修改已写入正确记录。',
  A6: '病历信息更正记录（虚构演示）\n更正项目：补齐本次门诊记录中的过敏史核对状态。\n核对结果：患者尚未完成确认，当前应记录为“待核实”，不得推定为“无过敏史”。\n修改说明：将原记录中未核实的过敏史标记更新为待核实，并保留原有内容及修改原因。\n后续处理：由接诊人员向患者确认后再更新最终信息。保存前核对患者身份、目标就诊记录及修改字段。',
};
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
export function panelPreferences(value) {
  const position = number => Number.isFinite(number) && number >= 0 && number <= 10000 ? number : null;
  return { open: value?.open === true, left: position(value?.left), top: position(value?.top) };
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
  if (value.bindingsConfigured === true) result.bindingsConfigured = true;
  ensure(Array.isArray(value.steps) && value.steps.length <= MAX_STEPS, '模板最多500个步骤');
  const origin = new URL(result.startUrl).origin;
  for (const s of value.steps) {
    ensure(s && ['click', 'input', 'select', 'check', 'scroll', 'navigate', 'wait', 'key', 'paste'].includes(s.type), '不支持的步骤类型');
    const step = { type: s.type, timeout: s.timeout ?? 15000 };
    if (s.label != null) step.label = text(s.label, '步骤名称', 120);
    if (s.disabled === true && ['input', 'select', 'paste'].includes(s.type)) step.disabled = true;
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
      if (s.type === 'wait' && s.expectedText != null) step.expectedText = text(s.expectedText, '成功标志文本', 4000);
      if (['input', 'select'].includes(s.type)) { ensure(typeof s.value === 'string' && s.value.length <= 4000, '输入值无效'); step.value = s.value; }
      if (s.type === 'check') { ensure(typeof s.checked === 'boolean', '勾选值无效'); step.checked = s.checked; }
      if (s.type === 'key') { ensure(['Enter', 'Tab', 'Escape'].includes(s.key), '不支持的按键'); step.key = s.key; }
    }
    result.steps.push(step);
  }
  const bindings = value.bindings ?? [];
  ensure(Array.isArray(bindings) && bindings.length <= MAX_STEPS, '变量绑定无效');
  const boundSteps = new Set();
  result.bindings = bindings.map(binding => {
    ensure(binding && Number.isInteger(binding.stepIndex) && binding.stepIndex >= 0 && binding.stepIndex < result.steps.length, '变量绑定步骤无效');
    const stepType = result.steps[binding.stepIndex].type;
    ensure(['input', 'select', 'paste'].includes(stepType), '变量只能绑定文本、下拉输入或正文粘贴步骤');
    ensure(!boundSteps.has(binding.stepIndex), '同一个步骤不能重复绑定变量');
    boundSteps.add(binding.stepIndex);
    const variable = text(binding.variable, '变量名', 64);
    ensure(/^[A-Za-z_][\w]{0,63}$/.test(variable) && !badKeys.has(variable), '变量名无效');
    ensure(stepType !== 'paste' || variable === 'taskText', '正文粘贴步骤必须绑定到 taskText');
    return { stepIndex: binding.stepIndex, variable };
  });
  return result;
}
export function describeStep(step) {
  const field = patientVariableForSelector(step.selector || '');
  const fieldNames = { patientName: '患者姓名', patientId: '患者编号', age: '年龄', searchWord: '患者查询词' };
  const selector = String(step.selector || '').toLowerCase().replace(/\s+/g, '');
  const knownTargets = [
    [/^a:nth-of-type\(3\)$/, '预约登记'],
    [/\.small-button/, '打开病历'],
    [/button\[type=["']?submit/, '提交表单'],
    [/aside\.sidebar>a:nth-of-type\(2\)/, '患者查询'],
    [/#save-note-draft/, '保存病历草稿'],
    [/^body(?:\b|$)/, '页面空白处'],
  ];
  const knownTarget = knownTargets.find(([pattern]) => pattern.test(selector))?.[1];
  const target = step.label || fieldNames[field] || knownTarget || step.selector || '';
  const labels = {
    click: `点击${target || '页面元素'}`,
    input: `填写${fieldNames[field] || target || '输入框'}`,
    select: `选择${fieldNames[field] || target || '下拉选项'}`,
    check: `勾选${target || '复选框'}`,
    scroll: '滚动页面',
    navigate: '打开页面',
    wait: step.expectedText ? `核对成功标志：${step.expectedText}` : `等待${target || '页面元素'}`,
    key: `按下${{ Enter: '回车', Tab: 'Tab', Escape: 'Esc' }[step.key] || '按键'}`,
    paste: '粘贴任务正文',
  };
  return labels[step.type] || '未知步骤';
}
export function reorderStep(value, index, direction) {
  const target = index + direction;
  if (!Number.isInteger(index) || !Number.isInteger(target) || index < 0 || index >= value.steps.length || target < 0 || target >= value.steps.length || Math.abs(direction) !== 1) return value;
  const steps = [...value.steps];
  [steps[index], steps[target]] = [steps[target], steps[index]];
  const bindings = (value.bindings || []).map(binding => ({
    ...binding,
    stepIndex: binding.stepIndex === index ? target : binding.stepIndex === target ? index : binding.stepIndex,
  }));
  return { ...value, steps, bindings };
}
export function removeStep(value, index) {
  if (!Number.isInteger(index) || index < 0 || index >= value.steps.length) return value;
  return {
    ...value,
    steps: value.steps.filter((_, stepIndex) => stepIndex !== index),
    bindings: (value.bindings || []).filter(binding => binding.stepIndex !== index).map(binding => ({
      ...binding, stepIndex: binding.stepIndex > index ? binding.stepIndex - 1 : binding.stepIndex,
    })),
  };
}
export function configureBindings(value, bindings) {
  const next = template({ ...value, bindings, bindingsConfigured: true });
  const hasTaskTextPaste = next.bindings.some(binding => next.steps[binding.stepIndex].type === 'paste' && binding.variable === 'taskText');
  if (hasTaskTextPaste) {
    const boundSteps = new Set(next.bindings.map(binding => binding.stepIndex));
    next.steps.forEach((step, stepIndex) => {
      if (step.type === 'paste' && !boundSteps.has(stepIndex)) next.bindings.push({ stepIndex, variable: 'taskText' });
    });
  }
  const selected = new Set(next.bindings.map(binding => binding.stepIndex));
  const pasteTargets = new Set(next.steps.filter(step => step.type === 'paste').map(step => step.selector));
  const boundInputTargets = new Set(next.bindings.filter(binding => ['input', 'select'].includes(next.steps[binding.stepIndex].type)).map(binding => next.steps[binding.stepIndex].selector));
  for (const binding of next.bindings) {
    const step = next.steps[binding.stepIndex];
    delete step.disabled;
    if (['input', 'select'].includes(step.type)) step.value = `{${binding.variable}}`;
  }
  next.steps.forEach((step, index) => {
    if (selected.has(index) || !['input', 'select', 'paste'].includes(step.type)) return;
    if (['input', 'select'].includes(step.type) && boundInputTargets.has(step.selector)) { step.disabled = true; return; }
    const wasVariable = value.bindings?.some(binding => binding.stepIndex === index)
      || /\{[A-Za-z_]\w*\}/.test(step.value || '') || pasteTargets.has(step.selector);
    // Removed bindings are deliberately inactive; never resurrect their old
    // placeholders or substitute an unrelated patient variable at playback.
    if (wasVariable) step.disabled = true;
  });
  return next;
}
export function task(value, templates) {
  ensure(value && typeof value === 'object', '任务无效');
  ensure(templates.some(t => t.templateId === value.templateId), '任务引用的模板不存在');
  return { instanceId: text(value.instanceId, '任务ID'), templateId: value.templateId, name: text(value.name, '任务名称'), variables: variables(value.variables) };
}
export function resolveSteps(t, vars) {
  ensure(t.steps.length > 0, '本组尚未录制流程，请先人工录制并绑定变量');
  const safeVars = variables(vars);
  const bindings = new Map((t.bindings || []).map(binding => [binding.stepIndex, binding.variable]));
  const pasteTargets = new Set(t.steps.filter(step => step.type === 'paste' && !step.disabled).map(step => step.selector));
  const source = [];
  for (let i = 0; i < t.steps.length; i++) {
    if (t.steps[i].disabled) continue;
    let variable = bindings.get(i);
    // Old recordings captured a fixed input value again when a pasted field
    // lost focus. Do not let that echo overwrite the current task's document.
    if (t.steps[i].type === 'input' && pasteTargets.has(t.steps[i].selector) && !variable && !/\{[A-Za-z_]\w*\}/.test(t.steps[i].value || '')) continue;
    if (t.steps[i].type === 'paste' && !variable) {
      if (safeVars.taskText?.trim()) variable = 'taskText';
      else if (safeVars.historyText?.trim()) variable = 'historyText';
    }
    // Compatibility for templates saved before variable bindings were stored
    // explicitly: use the task's real values for standard HIS patient fields.
    // An explicit mapping always wins, and an absent variable never silently
    // replaces the recorded sample value.
    if (!t.bindingsConfigured && !variable && ['input', 'select'].includes(t.steps[i].type) && !/\{[A-Za-z_]\w*\}/.test(t.steps[i].value || '')) {
      const candidate = patientVariableForSelector(t.steps[i].selector);
      if (candidate && Object.hasOwn(safeVars, candidate)) variable = candidate;
      else if (candidate === 'patientName' && Object.hasOwn(safeVars, 'searchWord')) variable = 'searchWord';
    }
    const step = variable && ['input', 'select'].includes(t.steps[i].type)
      ? { ...t.steps[i], value: `{${variable}}` }
      : variable && t.steps[i].type === 'paste'
        ? { ...t.steps[i], clipboardVariable: variable, replaceValue: true }
        : t.steps[i];
    if (step.type === 'click' && t.steps[i + 1]?.type === 'navigate') {
      source.push({ ...step, followNavigation: true });
      i++; // The click already navigates; never replay the sample patient's fixed URL.
    } else source.push(step);
  }
  return source.map(s => {
    if (s.type === 'paste' && s.clipboardVariable) ensure(typeof safeVars[s.clipboardVariable] === 'string' && safeVars[s.clipboardVariable].trim().length > 0, `缺少变量：${s.clipboardVariable}`);
    if (!['input', 'select'].includes(s.type)) return { ...s };
    return { ...s, value: interpolate(s.value, safeVars) };
  });
}
export function resolveSingleStep(t, index, vars) {
  ensure(Number.isInteger(index) && index >= 0 && index < t.steps.length, '流程步骤不存在');
  ensure(!t.steps[index].disabled, '此步骤已停用，不能试运行');
  const binding = t.bindings?.find(item => item.stepIndex === index);
  const single = { ...t, steps: [t.steps[index]], bindings: binding ? [{ ...binding, stepIndex: 0 }] : [] };
  const [step] = resolveSteps(single, vars);
  ensure(step, '此步骤没有可执行操作');
  return step;
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
  const templates = ['COD', 'A'].map(groupName => template({ templateId: `demo-${groupName}`, name: `${groupName} 分组流程`, groupName, startUrl: 'http://127.0.0.1:4174/search', steps: demo ? steps : [] }));
  const tasks = DEMO_PATIENTS.map(patient => {
    const { taskName: name, id: patientId, name: patientName, age, sex, department, phone } = patient;
    return { instanceId: `demo-${name}`, templateId: `demo-${name.startsWith('COD') ? 'COD' : 'A'}`, name, variables: { searchWord: patientName, patientName, patientId, age: String(age), sex, department, phone, taskText: DEMO_TASK_BODIES[name] } };
  });
  const additionalPatients = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
  for (const [index, sourceName] of additionalPatients.entries()) {
    const source = tasks.find(item => item.name === sourceName);
    const name = `COD${index + 7}`;
    tasks.push({ instanceId: `demo-${name}`, templateId: 'demo-COD', name, variables: { ...source.variables, taskText: DEMO_TASK_BODIES[name] } });
  }
  return { templates, tasks, settings: { externalOrigins: [], targetOrigins: ['http://127.0.0.1:4174'], externalEnabled: false }, runs: [], recording: null, activeRun: null, groupRun: null };
}

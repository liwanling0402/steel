/* ==========================================
   Steel 钢材管理系统 - 数据存储层
   封装所有 localStorage 读写操作
   v3.0 - 新增每日自动存档、历史日期查询、多次回款、预警系统
   ========================================== */

var STORAGE_KEY = 'steel_production_plans';
var STEEL_TYPES_HISTORY_KEY = 'steel_types_history';
var DAILY_ARCHIVE_KEY = 'steel_daily_archives';
var ARCHIVE_META_KEY = 'steel_archive_meta';

/**
 * 工序步骤定义
 */
var PROCESS_STEPS = [
  { key: 'material_prep',    label: '原料准备' },
  { key: 'cutting',          label: '切割下料' },
  { key: 'forming',          label: '成型加工' },
  { key: 'welding',          label: '焊接组装' },
  { key: 'surface_treatment',label: '表面处理' },
  { key: 'quality_check',    label: '质量检验' },
  { key: 'packaging',        label: '包装入库' }
];

/**
 * 进度状态定义
 */
var PROGRESS_STATUS = {
  pending:     { label: '待加工',   color: '#f97316', bg: '#fff7ed', cssClass: 'progress-pending' },
  processing:  { label: '加工中',   color: '#2563eb', bg: '#eff6ff', cssClass: 'progress-processing' },
  completed:   { label: '已完成',   color: '#16a34a', bg: '#f0fdf4', cssClass: 'progress-completed' },
  delayed:     { label: '延期',     color: '#dc2626', bg: '#fef2f2', cssClass: 'progress-delayed' }
};

/**
 * 为旧数据补充新字段，确保兼容性
 * @param {Object} plan - 计划对象
 * @returns {Object} 补全后的计划对象
 */
function normalizePlan(plan) {
  return {
    id: plan.id,
    planNo: plan.planNo || '',
    steelType: plan.steelType || '',
    specification: plan.specification || '',
    quantity: Number(plan.quantity) || 0,
    unit: plan.unit || '吨',
    deliveryDate: plan.deliveryDate || '',
    status: plan.status || 'pending',
    processStep: plan.processStep || '',
    progressStatus: plan.progressStatus || 'pending',
    customer: plan.customer || '',
    remark: plan.remark || '',
    operationLogs: plan.operationLogs || [],
    // 财务字段（默认空，仅三级弹窗操作）
    unitPrice: Number(plan.unitPrice) || 0,
    totalPrice: Number(plan.totalPrice) || 0,
    receivedAmount: Number(plan.receivedAmount) || 0,
    unpaidAmount: Number(plan.unpaidAmount) || 0,
    settleStatus: plan.settleStatus || 'unsettled',
    financeRemark: plan.financeRemark || '',
    financeLogs: plan.financeLogs || [],
    // 多次回款记录数组 [{ amount, date, method, remark, createdAt }]
    paymentRecords: plan.paymentRecords || [],
    createdAt: plan.createdAt || new Date().toISOString(),
    updatedAt: plan.updatedAt || plan.createdAt || new Date().toISOString()
  };
}

/**
 * 获取所有生产计划（自动兼容旧数据）
 * @returns {Array} 生产计划数组
 */
function getPlans() {
  try {
    var data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      // 尝试从备份恢复
      var tmpData = localStorage.getItem(STORAGE_KEY + '_tmp');
      if (tmpData) {
        try {
          var recovered = JSON.parse(tmpData);
          console.warn('[存储] 主数据为空，从备份恢复 ' + recovered.length + ' 条记录');
          localStorage.setItem(STORAGE_KEY, tmpData);
          localStorage.removeItem(STORAGE_KEY + '_tmp');
          return recovered.map(function (plan) { return normalizePlan(plan); });
        } catch (e2) { /* ignore */ }
      }
      return [];
    }
    var plans = JSON.parse(data);
    if (!Array.isArray(plans)) {
      console.warn('[存储] 数据格式异常，重置为空数组');
      return [];
    }
    return plans.map(function (plan) { return normalizePlan(plan); });
  } catch (e) {
    console.error('读取生产计划失败:', e);
    // 尝试从备份恢复
    try {
      var tmpData2 = localStorage.getItem(STORAGE_KEY + '_tmp');
      if (tmpData2) {
        var recovered2 = JSON.parse(tmpData2);
        if (Array.isArray(recovered2)) {
          localStorage.setItem(STORAGE_KEY, tmpData2);
          localStorage.removeItem(STORAGE_KEY + '_tmp');
          return recovered2.map(function (plan) { return normalizePlan(plan); });
        }
      }
    } catch (e3) { /* ignore */ }
    return [];
  }
}

/**
 * 保存所有生产计划到 localStorage
 * @param {Array} plans - 生产计划数组
 */
function savePlans(plans) {
  if (!Array.isArray(plans)) {
    console.error('[存储] 无效数据，拒绝保存');
    return;
  }
  try {
    var jsonStr = JSON.stringify(plans);
    // 双重保护：先写入临时 key，成功后再覆盖主 key
    var tmpKey = STORAGE_KEY + '_tmp';
    localStorage.setItem(tmpKey, jsonStr);
    localStorage.setItem(STORAGE_KEY, jsonStr);
    localStorage.removeItem(tmpKey);
  } catch (e) {
    console.error('保存生产计划失败:', e);
    if (e.name === 'QuotaExceededError') {
      throw new Error('存储空间已满，请导出数据后清理旧数据。');
    }
    throw new Error('数据保存失败: ' + e.message);
  }
}

/**
 * 根据 ID 获取单个生产计划
 * @param {string} id - 计划 ID
 * @returns {Object|null} 生产计划对象，未找到返回 null
 */
function getPlanById(id) {
  var plans = getPlans();
  var plan = plans.find(function (p) { return p.id === id; });
  return plan ? normalizePlan(plan) : null;
}

/**
 * 添加一条生产计划
 * @param {Object} planData - 计划数据（不含 id 和 createdAt）
 * @returns {Object} 新创建的计划对象
 */
function addPlan(planData) {
  var plans = getPlans();
  var now = new Date().toISOString();
  var newPlan = {
    id: generateId(),
    planNo: planData.planNo || '',
    steelType: planData.steelType || '',
    specification: planData.specification || '',
    quantity: Number(planData.quantity) || 0,
    unit: planData.unit || '吨',
    deliveryDate: planData.deliveryDate || '',
    status: planData.status || 'pending',
    processStep: planData.processStep || '',
    progressStatus: planData.progressStatus || 'pending',
    customer: planData.customer || '',
    remark: planData.remark || '',
    operationLogs: [],
    // 财务字段（默认空）
    unitPrice: 0,
    totalPrice: 0,
    receivedAmount: 0,
    unpaidAmount: 0,
    settleStatus: 'unsettled',
    financeRemark: '',
    financeLogs: [],
    paymentRecords: [],
    createdAt: now,
    updatedAt: now
  };
  plans.push(newPlan);
  savePlans(plans);
  return newPlan;
}

/**
 * 更新一条生产计划
 * @param {string} id - 计划 ID
 * @param {Object} planData - 要更新的字段
 * @returns {Object|null} 更新后的计划对象，未找到返回 null
 */
function updatePlan(id, planData) {
  var plans = getPlans();
  var index = plans.findIndex(function (plan) { return plan.id === id; });
  if (index === -1) return null;

  var existing = plans[index];
  var now = new Date().toISOString();
  plans[index] = {
    id: existing.id,
    planNo: planData.planNo !== undefined ? planData.planNo : existing.planNo,
    steelType: planData.steelType !== undefined ? planData.steelType : existing.steelType,
    specification: planData.specification !== undefined ? planData.specification : existing.specification,
    quantity: planData.quantity !== undefined ? Number(planData.quantity) : existing.quantity,
    unit: planData.unit !== undefined ? planData.unit : existing.unit,
    deliveryDate: planData.deliveryDate !== undefined ? planData.deliveryDate : existing.deliveryDate,
    status: planData.status !== undefined ? planData.status : existing.status,
    processStep: planData.processStep !== undefined ? planData.processStep : (existing.processStep || ''),
    progressStatus: planData.progressStatus !== undefined ? planData.progressStatus : (existing.progressStatus || 'pending'),
    customer: planData.customer !== undefined ? planData.customer : existing.customer,
    remark: planData.remark !== undefined ? planData.remark : existing.remark,
    operationLogs: planData.operationLogs !== undefined ? planData.operationLogs : (existing.operationLogs || []),
    // 财务字段
    unitPrice: planData.unitPrice !== undefined ? Number(planData.unitPrice) : (existing.unitPrice || 0),
    totalPrice: planData.totalPrice !== undefined ? Number(planData.totalPrice) : (existing.totalPrice || 0),
    receivedAmount: planData.receivedAmount !== undefined ? Number(planData.receivedAmount) : (existing.receivedAmount || 0),
    unpaidAmount: planData.unpaidAmount !== undefined ? Number(planData.unpaidAmount) : (existing.unpaidAmount || 0),
    settleStatus: planData.settleStatus !== undefined ? planData.settleStatus : (existing.settleStatus || 'unsettled'),
    financeRemark: planData.financeRemark !== undefined ? planData.financeRemark : (existing.financeRemark || ''),
    financeLogs: planData.financeLogs !== undefined ? planData.financeLogs : (existing.financeLogs || []),
    paymentRecords: planData.paymentRecords !== undefined ? planData.paymentRecords : (existing.paymentRecords || []),
    createdAt: existing.createdAt,
    updatedAt: now
  };
  savePlans(plans);
  return plans[index];
}

/**
 * 追加一条操作日志
 * @param {string} id - 计划 ID
 * @param {Object} logEntry - { action, from, to, field }
 */
function addOperationLog(id, logEntry) {
  var plans = getPlans();
  var index = plans.findIndex(function (plan) { return plan.id === id; });
  if (index === -1) return null;

  var existing = normalizePlan(plans[index]);
  if (!existing.operationLogs) existing.operationLogs = [];
  existing.operationLogs.push({
    timestamp: new Date().toISOString(),
    action: logEntry.action || 'update',
    from: logEntry.from || '',
    to: logEntry.to || '',
    field: logEntry.field || ''
  });
  existing.updatedAt = new Date().toISOString();
  plans[index] = existing;
  savePlans(plans);
  return existing;
}

/**
 * 删除一条生产计划
 * @param {string} id - 计划 ID
 * @returns {boolean} 是否删除成功
 */
function deletePlan(id) {
  var plans = getPlans();
  var index = plans.findIndex(function (plan) { return plan.id === id; });
  if (index === -1) return false;
  plans.splice(index, 1);
  savePlans(plans);
  return true;
}

/**
 * 删除所有生产计划
 * @returns {number} 删除的数量
 */
function clearAllPlans() {
  var count = getPlans().length;
  savePlans([]);
  return count;
}

/**
 * 获取计划总数
 * @returns {number}
 */
function getPlanCount() {
  return getPlans().length;
}

/**
 * 生成唯一 ID（时间戳 + 随机数）
 * @returns {string}
 */
function generateId() {
  return 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * 导出所有数据为 JSON 文件
 */
function exportData() {
  try {
    var plans = getPlans();
    var jsonStr = JSON.stringify(plans, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'steel_plans_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, count: plans.length };
  } catch (err) {
    return { success: false, count: 0, message: '导出失败: ' + err.message };
  }
}

/**
 * 导出数据为 Excel (CSV) 格式 — 自动携带全套生产+进度+财务数据
 */
function exportExcel() {
  var plans = getPlans();
  if (plans.length === 0) {
    return { success: false, count: 0, message: '暂无数据可导出' };
  }

  // BOM for Excel 正确识别 UTF-8 中文
  var BOM = '\uFEFF';
  var headers = [
    '计划编号', '钢材类型', '规格', '数量', '单位',
    '当前工序', '生产进度状态', '交货日期', '生产状态',
    '钢材单价(元)', '总价(元)', '已收金额(元)', '未收欠款(元)',
    '结算状态', '对账备注', '客户', '备注', '创建时间'
  ];

  var processStepMap = {};
  PROCESS_STEPS.forEach(function (s) { processStepMap[s.key] = s.label; });

  var rows = [headers.join(',')];

  plans.forEach(function (plan) {
    var row = [
      csvEscape(plan.planNo),
      csvEscape(plan.steelType),
      csvEscape(plan.specification),
      plan.quantity,
      csvEscape(plan.unit),
      csvEscape(processStepMap[plan.processStep] || (plan.processStep || '-')),
      csvEscape((PROGRESS_STATUS[plan.progressStatus] || PROGRESS_STATUS.pending).label),
      csvEscape(plan.deliveryDate),
      csvEscape(getStatusLabel(plan.status)),
      (Number(plan.unitPrice) || 0).toFixed(2),
      (Number(plan.totalPrice) || 0).toFixed(2),
      (Number(plan.receivedAmount) || 0).toFixed(2),
      (Number(plan.unpaidAmount) || 0).toFixed(2),
      csvEscape(getSettleLabel(plan.settleStatus || 'unsettled')),
      csvEscape(plan.financeRemark || '-'),
      csvEscape(plan.customer || '-'),
      csvEscape(plan.remark || '-'),
      csvEscape(plan.createdAt ? plan.createdAt.slice(0, 10) : '-')
    ];
    rows.push(row.join(','));
  });

  try {
    var csvStr = BOM + rows.join('\n');
    var blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'steel_plans_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, count: plans.length, message: 'Excel 导出成功！共 ' + plans.length + ' 条记录（含全套生产+财务数据）' };
  } catch (err) {
    return { success: false, count: 0, message: '导出失败: ' + err.message };
  }
}

function csvEscape(str) {
  if (!str) return '';
  str = String(str);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function getStatusLabel(status) {
  var map = { pending: '待生产', processing: '生产中', completed: '已完成', cancelled: '已取消' };
  return map[status] || status;
}

/**
 * 从 JSON 文件导入数据（合并模式）
 * @param {File} file - JSON 文件
 * @returns {Promise<number>} 导入的记录数
 */
function importData(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) {
          reject(new Error('文件格式不正确，需要 JSON 数组。'));
          return;
        }
        var plans = getPlans();
        var addedCount = 0;
        imported.forEach(function (item) {
          var exists = plans.some(function (p) { return p.id === item.id; });
          if (!exists) {
            plans.push(normalizePlan(item));
            addedCount++;
          }
        });
        savePlans(plans);
        resolve(addedCount);
      } catch (err) {
        reject(new Error('文件解析失败: ' + err.message));
      }
    };
    reader.onerror = function () {
      reject(new Error('文件读取失败。'));
    };
    reader.readAsText(file);
  });
}

/**
 * 计算进度统计数据
 * @returns {Object} { total, completedCount, completionRate, stepStats, progressStats }
 */
function getProgressStats() {
  var plans = getPlans();
  var total = plans.length;
  var completedCount = plans.filter(function (p) { return p.progressStatus === 'completed'; }).length;
  var completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // 各工序数量统计
  var stepStats = {};
  PROCESS_STEPS.forEach(function (step) {
    stepStats[step.key] = {
      label: step.label,
      total: plans.filter(function (p) { return p.processStep === step.key; }).length
    };
  });

  // 各进度状态数量
  var progressStats = {
    pending:    plans.filter(function (p) { return p.progressStatus === 'pending'; }).length,
    processing: plans.filter(function (p) { return p.progressStatus === 'processing'; }).length,
    completed:  plans.filter(function (p) { return p.progressStatus === 'completed'; }).length,
    delayed:    plans.filter(function (p) { return p.progressStatus === 'delayed'; }).length
  };

  return {
    total: total,
    completedCount: completedCount,
    completionRate: completionRate,
    stepStats: stepStats,
    progressStats: progressStats
  };
}

// ==========================================
// 钢材类型历史记录管理
// ==========================================

/**
 * 获取钢材类型历史记录
 * @returns {Array<string>} 历史钢材类型列表
 */
function getSteelTypesHistory() {
  try {
    var data = localStorage.getItem(STEEL_TYPES_HISTORY_KEY);
    if (!data) {
      // 首次使用，返回默认预设
      var defaults = ['热轧卷板', '冷轧卷板', '镀锌卷板', '中厚板', '螺纹钢', '线材', '型钢', '无缝钢管', '焊管', '不锈钢板'];
      return defaults;
    }
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

/**
 * 保存一条钢材类型到历史记录（去重，最多保留 20 条）
 * @param {string} steelType - 钢材类型
 */
function saveSteelTypeToHistory(steelType) {
  if (!steelType || !steelType.trim()) return;
  var type = steelType.trim();
  var history = getSteelTypesHistory();
  // 去重：如果已存在则移到最前面
  var idx = history.indexOf(type);
  if (idx !== -1) history.splice(idx, 1);
  history.unshift(type);
  // 最多保留 20 条
  if (history.length > 20) history = history.slice(0, 20);
  try {
    localStorage.setItem(STEEL_TYPES_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('保存钢材类型历史失败:', e);
  }
}

/**
 * 获取钢材类型 datalist 的 HTML 片段
 * @returns {string}
 */
function getSteelTypesDatalistHtml() {
  var history = getSteelTypesHistory();
  var html = '';
  history.forEach(function (t) {
    html += '<option value="' + escapeHtml(t) + '">';
  });
  return html;
}

// ==========================================
// 财务模块 — 结算状态定义与计算
// ==========================================

/**
 * 结算状态定义
 */
var SETTLE_STATUS = {
  unsettled:  { label: '未结算',   color: '#ef4444', bg: '#fef2f2', cssClass: 'settle-unsettled' },
  partial:    { label: '部分结算', color: '#f59e0b', bg: '#fffbeb', cssClass: 'settle-partial' },
  settled:    { label: '已结清',   color: '#16a34a', bg: '#f0fdf4', cssClass: 'settle-settled' }
};

/**
 * 自动计算结算状态
 * @param {Object} plan - 计划对象
 * @returns {string} 结算状态 key
 */
function calcSettleStatus(plan) {
  var totalPrice = Number(plan.totalPrice) || 0;
  var received = Number(plan.receivedAmount) || 0;
  if (totalPrice <= 0) return 'unsettled';
  if (received >= totalPrice) return 'settled';
  if (received > 0) return 'partial';
  return 'unsettled';
}

/**
 * 获取结算状态标签
 * @param {string} statusKey
 * @returns {string}
 */
function getSettleLabel(statusKey) {
  return (SETTLE_STATUS[statusKey] || SETTLE_STATUS.unsettled).label;
}

/**
 * 获取结算状态 CSS 类
 * @param {string} statusKey
 * @returns {string}
 */
function getSettleClass(statusKey) {
  return (SETTLE_STATUS[statusKey] || SETTLE_STATUS.unsettled).cssClass;
}

/**
 * 获取结算状态颜色
 * @param {string} statusKey
 * @returns {string}
 */
function getSettleColor(statusKey) {
  return (SETTLE_STATUS[statusKey] || SETTLE_STATUS.unsettled).color;
}

/**
 * 获取结算状态背景色
 * @param {string} statusKey
 * @returns {string}
 */
function getSettleBg(statusKey) {
  return (SETTLE_STATUS[statusKey] || SETTLE_STATUS.unsettled).bg;
}

/**
 * 更新计划的财务数据（独立于生产数据）
 * @param {string} id - 计划 ID
 * @param {Object} financeData - 财务数据 { unitPrice, receivedAmount, financeRemark }
 * @returns {Object|null}
 */
function updatePlanFinance(id, financeData) {
  var plan = getPlanById(id);
  if (!plan) return null;

  var unitPrice = financeData.unitPrice !== undefined ? Number(financeData.unitPrice) : (plan.unitPrice || 0);
  var totalPrice = unitPrice * (Number(plan.quantity) || 0);
  var receivedAmount = financeData.receivedAmount !== undefined ? Number(financeData.receivedAmount) : (plan.receivedAmount || 0);
  var unpaidAmount = totalPrice - receivedAmount;
  if (unpaidAmount < 0) unpaidAmount = 0;
  var settleStatus = calcSettleStatus({
    totalPrice: totalPrice,
    receivedAmount: receivedAmount
  });

  // 记录财务操作日志
  var financeLogs = (plan.financeLogs || []).slice();
  financeLogs.push({
    timestamp: new Date().toISOString(),
    action: '更新财务数据',
    detail: '单价:' + unitPrice + ' 总价:' + totalPrice + ' 已收:' + receivedAmount + ' 未收:' + unpaidAmount + ' 状态:' + getSettleLabel(settleStatus)
  });

  return updatePlan(id, {
    unitPrice: unitPrice,
    totalPrice: totalPrice,
    receivedAmount: receivedAmount,
    unpaidAmount: unpaidAmount,
    settleStatus: settleStatus,
    financeRemark: financeData.financeRemark !== undefined ? financeData.financeRemark : (plan.financeRemark || ''),
    financeLogs: financeLogs
  });
}

// ==========================================
// 每日自动存档系统
// ==========================================

/**
 * 获取今天日期字符串 YYYY-MM-DD
 */
function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * 获取当前时间字符串 YYYY-MM-DD HH:mm
 */
function getNowStr() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

/**
 * 执行每日自动存档（在每次数据变更后调用）
 * 按日期存储完整数据快照，每天只存一份（覆盖当天之前的）
 */
function autoDailyArchive() {
  try {
    var today = getTodayStr();
    var plans = getPlans();
    var meta = getArchiveMeta();

    // 如果今天已经存档过且数据未变化，跳过
    if (meta.lastArchiveDate === today && meta.lastArchiveCount === plans.length) {
      return;
    }

    var archive = {
      date: today,
      timestamp: new Date().toISOString(),
      count: plans.length,
      data: JSON.parse(JSON.stringify(plans)) // 深拷贝
    };

    // 存储当天存档
    localStorage.setItem(DAILY_ARCHIVE_KEY + '_' + today, JSON.stringify(archive));

    // 更新元信息
    meta.lastArchiveDate = today;
    meta.lastArchiveCount = plans.length;
    meta.totalArchives = (meta.totalArchives || 0) + 1;
    if (!meta.archiveDates) meta.archiveDates = [];
    if (meta.archiveDates.indexOf(today) === -1) {
      meta.archiveDates.push(today);
      // 只保留最近90天的索引
      if (meta.archiveDates.length > 90) {
        meta.archiveDates = meta.archiveDates.slice(-90);
      }
    }
    saveArchiveMeta(meta);

    // 清理超过90天的旧存档
    cleanOldArchives(meta.archiveDates);

    console.log('[存档] 每日自动存档完成: ' + today + ' (' + plans.length + ' 条记录)');
  } catch (e) {
    console.error('[存档] 自动存档失败:', e);
  }
}

/**
 * 获取存档元信息
 */
function getArchiveMeta() {
  try {
    var data = localStorage.getItem(ARCHIVE_META_KEY);
    return data ? JSON.parse(data) : { lastArchiveDate: '', lastArchiveCount: 0, totalArchives: 0, archiveDates: [] };
  } catch (e) {
    return { lastArchiveDate: '', lastArchiveCount: 0, totalArchives: 0, archiveDates: [] };
  }
}

/**
 * 保存存档元信息
 */
function saveArchiveMeta(meta) {
  try {
    localStorage.setItem(ARCHIVE_META_KEY, JSON.stringify(meta));
  } catch (e) { /* ignore */ }
}

/**
 * 清理超过90天的旧存档
 */
function cleanOldArchives(dates) {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  var cutoffStr = cutoff.toISOString().slice(0, 10);

  var toRemove = [];
  for (var i = 0; i < dates.length; i++) {
    if (dates[i] < cutoffStr) {
      toRemove.push(dates[i]);
    }
  }

  for (var j = 0; j < toRemove.length; j++) {
    try {
      localStorage.removeItem(DAILY_ARCHIVE_KEY + '_' + toRemove[j]);
    } catch (e) { /* ignore */ }
  }
}

/**
 * 获取指定日期的存档数据
 * @param {string} dateStr - YYYY-MM-DD 格式日期
 * @returns {Object|null} 存档对象
 */
function getArchiveByDate(dateStr) {
  try {
    var data = localStorage.getItem(DAILY_ARCHIVE_KEY + '_' + dateStr);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取所有可查询的存档日期列表
 * @returns {Array<string>} 日期字符串数组
 */
function getArchiveDates() {
  var meta = getArchiveMeta();
  var dates = meta.archiveDates || [];
  // 倒序排列
  dates.sort(function (a, b) { return b.localeCompare(a); });
  return dates;
}

/**
 * 获取存档统计数据
 * @returns {Object}
 */
function getArchiveStats() {
  var meta = getArchiveMeta();
  var dates = meta.archiveDates || [];
  return {
    lastArchiveDate: meta.lastArchiveDate || '暂无',
    totalArchives: dates.length,
    archiveDates: dates
  };
}

/**
 * 手动触发存档（供手动备份按钮调用）
 * @returns {Object}
 */
function manualArchive() {
  try {
    var today = getTodayStr();
    var plans = getPlans();
    var archive = {
      date: today,
      timestamp: new Date().toISOString(),
      count: plans.length,
      data: JSON.parse(JSON.stringify(plans))
    };
    localStorage.setItem(DAILY_ARCHIVE_KEY + '_' + today, JSON.stringify(archive));

    var meta = getArchiveMeta();
    meta.lastArchiveDate = today;
    meta.lastArchiveCount = plans.length;
    if (!meta.archiveDates) meta.archiveDates = [];
    if (meta.archiveDates.indexOf(today) === -1) {
      meta.archiveDates.push(today);
    }
    saveArchiveMeta(meta);
    return { success: true, date: today, count: plans.length };
  } catch (e) {
    return { success: false, message: '手动存档失败: ' + e.message };
  }
}

// ==========================================
// 订单智能预警系统
// ==========================================

/**
 * 预警级别定义
 */
var ALERT_LEVELS = {
  overdue:    { label: '已延期',   color: '#dc2626', bg: '#fef2f2', icon: '🔴', priority: 0 },
  today:      { label: '今日到期', color: '#f59e0b', bg: '#fffbeb', icon: '🟡', priority: 1 },
  soon:       { label: '即将到期', color: '#f97316', bg: '#fff7ed', icon: '🟠', priority: 2 },
  normal:     { label: '正常',     color: '#16a34a', bg: '#f0fdf4', icon: '🟢', priority: 3 }
};

/**
 * 获取订单预警级别
 * @param {Object} plan - 计划对象
 * @returns {Object} 预警级别对象
 */
function getAlertLevel(plan) {
  // 已完成或已取消的订单不预警
  if (plan.status === 'completed' || plan.status === 'cancelled') {
    return ALERT_LEVELS.normal;
  }
  if (plan.progressStatus === 'completed') {
    return ALERT_LEVELS.normal;
  }

  if (!plan.deliveryDate) return ALERT_LEVELS.normal;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var delivery = new Date(plan.deliveryDate + 'T00:00:00');
  var diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return ALERT_LEVELS.overdue;
  if (diffDays === 0) return ALERT_LEVELS.today;
  if (diffDays <= 3) return ALERT_LEVELS.soon;
  return ALERT_LEVELS.normal;
}

/**
 * 获取所有预警订单
 * @returns {Array} 按紧急程度排序的预警订单列表
 */
function getAlertOrders() {
  var plans = getPlans();
  var alerts = [];
  plans.forEach(function (plan) {
    var level = getAlertLevel(plan);
    if (level.priority <= 2) { // overdue, today, soon
      alerts.push({
        plan: plan,
        level: level,
        daysLeft: getDaysUntilDelivery(plan.deliveryDate)
      });
    }
  });
  // 按优先级排序
  alerts.sort(function (a, b) { return a.level.priority - b.level.priority; });
  return alerts;
}

/**
 * 获取距离交货日期的天数
 * @param {string} deliveryDate
 * @returns {number}
 */
function getDaysUntilDelivery(deliveryDate) {
  if (!deliveryDate) return 0;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var delivery = new Date(deliveryDate + 'T00:00:00');
  return Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
}

// ==========================================
// 多次回款记录管理
// ==========================================

/**
 * 添加一笔回款记录
 * @param {string} planId - 计划 ID
 * @param {Object} payment - { amount, date, method, remark }
 * @returns {Object|null} 更新后的计划
 */
function addPaymentRecord(planId, payment) {
  var plan = getPlanById(planId);
  if (!plan) return null;

  var amount = Number(payment.amount) || 0;
  if (amount <= 0) return null;

  var records = (plan.paymentRecords || []).slice();
  records.push({
    id: 'pmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    amount: amount,
    date: payment.date || getTodayStr(),
    method: payment.method || '银行转账',
    remark: payment.remark || '',
    createdAt: new Date().toISOString()
  });

  // 重新计算已收总额
  var totalReceived = 0;
  records.forEach(function (r) { totalReceived += Number(r.amount) || 0; });

  var totalPrice = Number(plan.totalPrice) || 0;
  var unpaidAmount = totalPrice - totalReceived;
  if (unpaidAmount < 0) unpaidAmount = 0;

  var settleStatus = calcSettleStatus({ totalPrice: totalPrice, receivedAmount: totalReceived });

  // 财务日志
  var financeLogs = (plan.financeLogs || []).slice();
  financeLogs.push({
    timestamp: new Date().toISOString(),
    action: '回款录入',
    detail: '收款 ¥' + formatMoney(amount) + ' | 方式:' + (payment.method || '银行转账') + ' | 累计已收: ¥' + formatMoney(totalReceived)
  });

  return updatePlan(planId, {
    paymentRecords: records,
    receivedAmount: totalReceived,
    unpaidAmount: unpaidAmount,
    settleStatus: settleStatus,
    financeLogs: financeLogs
  });
}

/**
 * 删除一笔回款记录
 * @param {string} planId
 * @param {string} paymentId
 * @returns {Object|null}
 */
function deletePaymentRecord(planId, paymentId) {
  var plan = getPlanById(planId);
  if (!plan) return null;

  var records = (plan.paymentRecords || []).slice();
  var idx = records.findIndex(function (r) { return r.id === paymentId; });
  if (idx === -1) return null;

  var deleted = records.splice(idx, 1)[0];

  // 重新计算
  var totalReceived = 0;
  records.forEach(function (r) { totalReceived += Number(r.amount) || 0; });

  var totalPrice = Number(plan.totalPrice) || 0;
  var unpaidAmount = totalPrice - totalReceived;
  if (unpaidAmount < 0) unpaidAmount = 0;

  var settleStatus = calcSettleStatus({ totalPrice: totalPrice, receivedAmount: totalReceived });

  var financeLogs = (plan.financeLogs || []).slice();
  financeLogs.push({
    timestamp: new Date().toISOString(),
    action: '删除回款',
    detail: '删除回款 ¥' + formatMoney(deleted.amount || 0) + ' | 累计已收: ¥' + formatMoney(totalReceived)
  });

  return updatePlan(planId, {
    paymentRecords: records,
    receivedAmount: totalReceived,
    unpaidAmount: unpaidAmount,
    settleStatus: settleStatus,
    financeLogs: financeLogs
  });
}

// ==========================================
// 修改 savePlans 以自动触发存档
// ==========================================
var _originalSavePlans = savePlans;
savePlans = function (plans) {
  var result = _originalSavePlans(plans);
  // 延迟存档，避免阻塞主流程
  try { autoDailyArchive(); } catch (e) { /* ignore */ }
  return result;
};

/**
 * 导出财务账单 Excel (CSV)
 * 包含全套财务字段
 */
function exportFinanceExcel() {
  var plans = getPlans();
  if (plans.length === 0) {
    return { success: false, count: 0, message: '暂无数据可导出' };
  }

  var BOM = '\uFEFF';
  var headers = [
    '计划编号', '钢材类型', '规格', '数量', '单位',
    '钢材单价(元)', '单吨总价(元)', '已收金额(元)', '未收欠款(元)',
    '结算状态', '对账备注', '当前工序', '进度状态', '生产状态',
    '客户', '交货日期', '创建时间'
  ];

  var processStepMap = {};
  PROCESS_STEPS.forEach(function (s) { processStepMap[s.key] = s.label; });

  var rows = [headers.join(',')];

  plans.forEach(function (plan) {
    var row = [
      csvEscape(plan.planNo),
      csvEscape(plan.steelType),
      csvEscape(plan.specification),
      plan.quantity,
      csvEscape(plan.unit),
      (plan.unitPrice || 0).toFixed(2),
      (plan.totalPrice || 0).toFixed(2),
      (plan.receivedAmount || 0).toFixed(2),
      (plan.unpaidAmount || 0).toFixed(2),
      csvEscape(getSettleLabel(plan.settleStatus || 'unsettled')),
      csvEscape(plan.financeRemark || '-'),
      csvEscape(processStepMap[plan.processStep] || '-'),
      csvEscape((PROGRESS_STATUS[plan.progressStatus] || PROGRESS_STATUS.pending).label),
      csvEscape(getStatusLabel(plan.status)),
      csvEscape(plan.customer || '-'),
      csvEscape(plan.deliveryDate),
      csvEscape(plan.createdAt ? plan.createdAt.slice(0, 10) : '-')
    ];
    rows.push(row.join(','));
  });

  try {
    var csvStr = BOM + rows.join('\n');
    var blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'steel_finance_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, count: plans.length, message: '财务账单导出成功！共 ' + plans.length + ' 条记录' };
  } catch (err) {
    return { success: false, count: 0, message: '导出失败: ' + err.message };
  }
}

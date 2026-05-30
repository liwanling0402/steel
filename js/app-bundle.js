/* Steel v4.0 APP Bundle */
/* 合并自: storage.js, production-form.js, production-list.js, customer-service.js, app.js */
"use strict";


/* ===== storage.js ===== */
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


/* ===== production-form.js ===== */
/* ==========================================
   Steel 钢材管理系统 - 生产计划录入表单模块
   v2.1 - 新增工序字段、进度状态字段、防重复提交
   ========================================== */

// 防止重复提交标志
var isFormSubmitting = false;

/**
 * 渲染生产计划录入表单
 */
function renderForm() {
  var container = document.getElementById('formContainer');
  if (!container) return;
  // 防止重复渲染
  if (document.getElementById('productionForm')) return;

  container.innerHTML = '\
    <form id="productionForm" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8" novalidate>\
      \
      <!-- 表单标题行 -->\
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">\
        <div class="flex items-center space-x-2">\
          <span class="text-lg">📝</span>\
          <h3 class="text-lg font-bold text-gray-800">新建生产计划</h3>\
        </div>\
        <span class="text-xs text-gray-400">* 为必填项</span>\
      </div>\
      \
      <!-- 表单字段区 -->\
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">\
        \
        <!-- 计划编号 -->\
        <div class="md:col-span-2">\
          <label class="form-label" for="planNo">计划编号 <span class="text-red-500">*</span></label>\
          <input\
            type="text"\
            id="planNo"\
            class="form-input"\
            placeholder="例如: PL-20260529-001"\
            maxlength="50"\
          />\
          <p class="form-error-msg" id="planNoError">请输入计划编号</p>\
        </div>\
        \
        <!-- 钢材类型（可输入 + 历史记忆） -->\
        <div>\
          <label class="form-label" for="steelType">钢材类型 <span class="text-red-500">*</span></label>\
          <input\
            type="text"\
            id="steelType"\
            class="form-input"\
            placeholder="输入钢材类型，如：热轧卷板"\
            list="steelTypeList"\
            autocomplete="off"\
            maxlength="50"\
          />\
          <datalist id="steelTypeList">\
            ' + getSteelTypesDatalistHtml() + '\
          </datalist>\
          <p class="form-error-msg" id="steelTypeError">请输入钢材类型</p>\
        </div>\
        \
        <!-- 规格 -->\
        <div>\
          <label class="form-label" for="specification">规格 <span class="text-red-500">*</span></label>\
          <input\
            type="text"\
            id="specification"\
            class="form-input"\
            placeholder="例如: 2.0mm×1250mm×C"\
            maxlength="100"\
          />\
          <p class="form-error-msg" id="specificationError">请输入规格</p>\
        </div>\
        \
        <!-- 数量 -->\
        <div>\
          <label class="form-label" for="quantity">计划数量 <span class="text-red-500">*</span></label>\
          <input\
            type="number"\
            id="quantity"\
            class="form-input"\
            placeholder="请输入数量"\
            min="0.01"\
            step="0.01"\
          />\
          <p class="form-error-msg" id="quantityError">请输入有效的数量（大于 0）</p>\
        </div>\
        \
        <!-- 单位 -->\
        <div>\
          <label class="form-label" for="unit">单位</label>\
          <select id="unit" class="form-select">\
            <option value="吨">吨</option>\
            <option value="千克">千克</option>\
            <option value="件">件</option>\
            <option value="米">米</option>\
            <option value="支">支</option>\
          </select>\
        </div>\
        \
        <!-- 交货日期 -->\
        <div>\
          <label class="form-label" for="deliveryDate">交货日期 <span class="text-red-500">*</span></label>\
          <input\
            type="date"\
            id="deliveryDate"\
            class="form-input"\
          />\
          <p class="form-error-msg" id="deliveryDateError">请选择交货日期</p>\
        </div>\
        \
        <!-- 状态 -->\
        <div>\
          <label class="form-label" for="status">生产状态</label>\
          <select id="status" class="form-select">\
            <option value="pending">待生产</option>\
            <option value="processing">生产中</option>\
            <option value="completed">已完成</option>\
            <option value="cancelled">已取消</option>\
          </select>\
        </div>\
        \
        <!-- 当前工序 -->\
        <div>\
          <label class="form-label" for="processStep">当前工序</label>\
          <select id="processStep" class="form-select">\
            <option value="">未指定</option>\
            <option value="material_prep">原料准备</option>\
            <option value="cutting">切割下料</option>\
            <option value="forming">成型加工</option>\
            <option value="welding">焊接组装</option>\
            <option value="surface_treatment">表面处理</option>\
            <option value="quality_check">质量检验</option>\
            <option value="packaging">包装入库</option>\
          </select>\
        </div>\
        \
        <!-- 进度状态 -->\
        <div>\
          <label class="form-label" for="progressStatus">进度状态</label>\
          <select id="progressStatus" class="form-select">\
            <option value="pending">待加工</option>\
            <option value="processing">加工中</option>\
            <option value="completed">已完成</option>\
            <option value="delayed">延期</option>\
          </select>\
        </div>\
        \
        <!-- 客户名称 -->\
        <div class="md:col-span-2">\
          <label class="form-label" for="customer">客户名称</label>\
          <input\
            type="text"\
            id="customer"\
            class="form-input"\
            placeholder="请输入客户名称（选填）"\
            maxlength="100"\
          />\
        </div>\
        \
        <!-- 备注 -->\
        <div class="md:col-span-2">\
          <label class="form-label" for="remark">备注</label>\
          <textarea\
            id="remark"\
            class="form-textarea"\
            rows="3"\
            placeholder="请输入备注信息（选填）"\
            maxlength="500"\
          ></textarea>\
          <p class="text-xs text-gray-400 mt-1 text-right"><span id="remarkCount">0</span>/500</p>\
        </div>\
        \
      </div>\
      \
      <!-- 提交按钮区 -->\
      <div class="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 pt-4 border-t border-gray-100">\
        <button type="button" class="btn-secondary" onclick="resetForm()">\
          🔄 重置表单\
        </button>\
        <button type="submit" class="btn-primary" id="submitBtn">\
          ✅ 提交计划\
        </button>\
      </div>\
      \
    </form>\
  ';

  // 绑定事件
  bindFormEvents();
}

/**
 * 绑定表单事件
 */
function bindFormEvents() {
  var form = document.getElementById('productionForm');
  if (!form) return;

  // 备注字数统计
  var remarkInput = document.getElementById('remark');
  var remarkCount = document.getElementById('remarkCount');
  if (remarkInput && remarkCount) {
    remarkInput.addEventListener('input', function () {
      remarkCount.textContent = remarkInput.value.length;
    });
  }

  // 表单提交
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleFormSubmit();
  });

  // 实时清除错误态
  var inputs = form.querySelectorAll('.form-input, .form-select, .form-textarea');
  inputs.forEach(function (input) {
    input.addEventListener('input', function () {
      input.classList.remove('error');
      var errorEl = document.getElementById(input.id + 'Error');
      if (errorEl) errorEl.classList.remove('show');
    });
    input.addEventListener('change', function () {
      input.classList.remove('error');
      var errorEl = document.getElementById(input.id + 'Error');
      if (errorEl) errorEl.classList.remove('show');
    });
  });
}

/**
 * 处理表单提交
 */
function handleFormSubmit() {
  // 防止重复提交
  if (isFormSubmitting) return;
  isFormSubmitting = true;

  // 获取表单数据
  var formData = {
    planNo: document.getElementById('planNo').value.trim(),
    steelType: document.getElementById('steelType').value,
    specification: document.getElementById('specification').value.trim(),
    quantity: document.getElementById('quantity').value,
    unit: document.getElementById('unit').value,
    deliveryDate: document.getElementById('deliveryDate').value,
    status: document.getElementById('status').value,
    processStep: document.getElementById('processStep').value,
    progressStatus: document.getElementById('progressStatus').value,
    customer: document.getElementById('customer').value.trim(),
    remark: document.getElementById('remark').value.trim()
  };

  // 校验
  if (!validateForm(formData)) {
    isFormSubmitting = false;
    return;
  }

  // 提交
  try {
    addPlan(formData);
    // 保存钢材类型到历史记录
    saveSteelTypeToHistory(formData.steelType);
    showToast('生产计划提交成功！', 'success');
    resetForm();
    // 刷新 datalist
    refreshSteelTypeDatalist('steelTypeList');
  } catch (err) {
    showToast('提交失败: ' + err.message, 'error');
  }

  // 恢复提交状态
  isFormSubmitting = false;
}

/**
 * 表单校验
 * @param {Object} data - 表单数据
 * @returns {boolean} 是否通过校验
 */
function validateForm(data) {
  var valid = true;

  // 计划编号
  if (!data.planNo) {
    showFieldError('planNo');
    valid = false;
  }

  // 钢材类型
  if (!data.steelType) {
    showFieldError('steelType');
    valid = false;
  }

  // 规格
  if (!data.specification) {
    showFieldError('specification');
    valid = false;
  }

  // 数量
  var qty = parseFloat(data.quantity);
  if (isNaN(qty) || qty <= 0) {
    showFieldError('quantity');
    valid = false;
  }

  // 交货日期
  if (!data.deliveryDate) {
    showFieldError('deliveryDate');
    valid = false;
  }

  return valid;
}

/**
 * 显示字段错误
 * @param {string} fieldId - 字段 ID
 */
function showFieldError(fieldId) {
  var input = document.getElementById(fieldId);
  var error = document.getElementById(fieldId + 'Error');
  if (input) input.classList.add('error');
  if (error) error.classList.add('show');
}

/**
 * 重置表单
 */
function resetForm() {
  var form = document.getElementById('productionForm');
  if (!form) return;

  form.reset();
  // 清除所有错误态
  var errorInputs = form.querySelectorAll('.error');
  errorInputs.forEach(function (el) { el.classList.remove('error'); });
  var errorMsgs = form.querySelectorAll('.form-error-msg.show');
  errorMsgs.forEach(function (el) { el.classList.remove('show'); });
  // 重置备注计数
  var remarkCount = document.getElementById('remarkCount');
  if (remarkCount) remarkCount.textContent = '0';
}

/**
 * 显示 Toast 消息
 * @param {string} message - 消息内容
 * @param {string} type - success | error | warning | info
 */
function showToast(message, type) {
  var toast = document.getElementById('toast');
  var toastContent = document.getElementById('toastContent');
  if (!toast || !toastContent) return;

  // 清除之前的定时器
  if (toast._timeout) {
    clearTimeout(toast._timeout);
    toast._timeout = null;
  }

  // 颜色配置
  var colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  var icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toastContent.className = 'flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ' + (colors[type] || colors.info);
  toastContent.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + escapeHtml(String(message)) + '</span>';

  // 显示
  toast.classList.remove('hide');
  toast.classList.add('show');

  // 自动隐藏
  toast._timeout = setTimeout(function () {
    if (toast) {
      toast.classList.add('hide');
      toast.classList.remove('show');
    }
  }, 3000);
}

/**
 * HTML 转义，防止 XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  if (typeof str !== 'string') str = String(str);
  try {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  } catch (e) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

/**
 * 刷新钢材类型 datalist
 * @param {string} datalistId - datalist 元素 ID
 */
function refreshSteelTypeDatalist(datalistId) {
  var list = document.getElementById(datalistId);
  if (!list) return;
  list.innerHTML = getSteelTypesDatalistHtml();
}


/* ===== production-list.js ===== */
/* ==========================================
   Steel 钢材管理系统 - 生产计划列表模块
   v3.0 - 三级详情弹窗（含财务模块）、进度管理、预警系统、历史查询
   ========================================== */

// 当前编辑的 ID（null 表示新建模式）
var editingId = null;
// 当前删除的 ID
var deletingId = null;
// 进度弹窗相关
var progressPlanId = null;
var pendingProgressStep = null;
var pendingProgressStatus = null;
var progressPlansCache = [];
// 进度原始值（用于判断是否有未保存修改）
var originalProgressStep = null;
var originalProgressStatus = null;
// 防重复保存标志
var isSavingProgress = false;
// 防重复编辑提交
var isEditingSubmitting = false;
// 三级详情弹窗相关
var detailPlanId = null;
var isDetailSaving = false;
// 预警面板
var isAlertPanelExpanded = false;
// 历史查询
var historySearchTimer = null;

/**
 * 渲染生产计划列表页面
 */
function renderList() {
  var container = document.getElementById('listContainer');
  if (!container) return;

  var plans;
  try {
    plans = getPlans();
    if (!Array.isArray(plans)) plans = [];
  } catch (e) {
    console.error('[列表] 读取数据失败:', e);
    plans = [];
  }

  container.innerHTML = '\
    <!-- 筛选工具栏 -->\
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-4">\
      <div class="filter-bar">\
        <!-- 搜索框 -->\
        <div class="filter-input relative">\
          <input\
            type="text"\
            id="searchInput"\
            class="form-input pl-9"\
            placeholder="搜索计划编号、钢材类型、规格、客户..."\
          />\
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>\
        </div>\
        \
        <!-- 状态筛选 -->\
        <select id="statusFilter" class="form-select" style="width:auto;min-width:130px;">\
          <option value="all">全部状态</option>\
          <option value="pending">待生产</option>\
          <option value="processing">生产中</option>\
          <option value="completed">已完成</option>\
          <option value="cancelled">已取消</option>\
        </select>\
        \
        <!-- 操作按钮 -->\
        <div class="flex gap-2 flex-shrink-0 flex-wrap">\
          <button class="btn-secondary text-sm py-2 px-3" onclick="handleExportData()" title="导出JSON数据">\
            📥 导出\
          </button>\
          <button class="btn-primary text-sm py-2 px-3" onclick="openFinanceTableModal()" title="打开财务对账在线编辑表格">\
            💰 财务对账\
          </button>\
          <button class="btn-secondary text-sm py-2 px-3" onclick="document.getElementById(\'importFile\').click()" title="导入数据">\
            📤 导入\
          </button>\
          \r\n          <button class=\"btn-secondary text-sm py-2 px-3\" onclick=\"openHistoryModal()\" title=\"查看历史存档数据\">\r\n            📅 历史\r\n          </button>\r\n          <input type="file" id="importFile" accept=".json" class="hidden" onchange="handleImport(event)" />\
        </div>\
      </div>\
    </div>\
    \
    <!-- 进度统计面板 -->\
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-4" id="progressStatsPanel">\
    </div>\
    \
    <!-- 统计信息 -->\
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" id="statsBar">\
    </div>\
    \
    <!-- 列表内容区 -->\
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">\
      <div id="listContent"></div>\
    </div>\
  ';

  // 渲染各区块
  renderAlertPanel(plans);
  renderProgressStats(plans);
  renderStats(plans);
  renderListContent(plans);
  bindListEvents();
}

/**
 * 渲染进度统计面板
 */
function renderProgressStats(plans) {
  var panel = document.getElementById('progressStatsPanel');
  if (!panel) return;

  var stats = getProgressStats();
  var total = stats.total;

  if (total === 0) {
    panel.innerHTML = '\
      <div class="flex items-center justify-between mb-3">\
        <h4 class="font-bold text-gray-700 text-sm">📊 生产进度概览</h4>\
      </div>\
      <p class="text-gray-400 text-sm text-center py-2">暂无数据</p>\
    ';
    return;
  }

  // 完成率进度条
  var barColor = stats.completionRate >= 80 ? '#16a34a' : (stats.completionRate >= 50 ? '#2563eb' : '#f97316');

  var html = '\
    <div class="flex items-center justify-between mb-3">\
      <h4 class="font-bold text-gray-700 text-sm">📊 生产进度概览</h4>\
      <span class="text-xs text-gray-400">共 ' + total + ' 条计划</span>\
    </div>\
    \
    <!-- 总完成率 -->\
    <div class="mb-3">\
      <div class="flex items-center justify-between mb-1">\
        <span class="text-xs text-gray-500">总完成率</span>\
        <span class="text-sm font-bold" style="color:' + barColor + '">' + stats.completionRate + '%</span>\
      </div>\
      <div class="progress-bar-bg">\
        <div class="progress-bar-fill" style="width:' + stats.completionRate + '%; background:' + barColor + ';"></div>\
      </div>\
    </div>\
    \
    <!-- 进度状态分布 -->\
    <div class="progress-stat-panel">\
      <div class="progress-stat-card">\
        <div class="progress-stat-value" style="color:#f97316;">' + stats.progressStats.pending + '</div>\
        <div class="progress-stat-label">待加工</div>\
      </div>\
      <div class="progress-stat-card">\
        <div class="progress-stat-value" style="color:#2563eb;">' + stats.progressStats.processing + '</div>\
        <div class="progress-stat-label">加工中</div>\
      </div>\
      <div class="progress-stat-card">\
        <div class="progress-stat-value" style="color:#16a34a;">' + stats.progressStats.completed + '</div>\
        <div class="progress-stat-label">已完成</div>\
      </div>\
      <div class="progress-stat-card">\
        <div class="progress-stat-value" style="color:#dc2626;">' + stats.progressStats.delayed + '</div>\
        <div class="progress-stat-label">延期</div>\
      </div>\
    </div>\
    \
    <!-- 各工序统计（折叠区） -->\
    <details class="mt-3">\
      <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">展开各工序统计 ▼</summary>\
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">\
  ';

  var stepKeys = Object.keys(stats.stepStats);
  stepKeys.forEach(function (key) {
    var s = stats.stepStats[key];
    html += '\
        <div class="bg-gray-50 rounded-lg px-3 py-2 text-center">\
          <div class="text-sm font-bold text-gray-700">' + s.total + '</div>\
          <div class="text-xs text-gray-400">' + s.label + '</div>\
        </div>\
    ';
  });

  html += '\
      </div>\
    </details>\
  ';

  panel.innerHTML = html;
}

/**
 * 渲染统计栏
 */
function renderStats(plans) {
  var statsBar = document.getElementById('statsBar');
  if (!statsBar) return;

  var total = plans.length;
  var pending = plans.filter(function (p) { return p.status === 'pending'; }).length;
  var processing = plans.filter(function (p) { return p.status === 'processing'; }).length;
  var completed = plans.filter(function (p) { return p.status === 'completed'; }).length;

  var stats = [
    { label: '总计划数', value: total, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: '待生产', value: pending, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: '生产中', value: processing, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: '已完成', value: completed, color: 'bg-green-50 text-green-700 border-green-200' }
  ];

  statsBar.innerHTML = stats.map(function (s) {
    return '\
      <div class="' + s.color + ' border rounded-lg px-3 py-3 text-center">\
        <div class="text-2xl font-bold">' + s.value + '</div>\
        <div class="text-xs mt-1 opacity-75">' + s.label + '</div>\
      </div>\
    ';
  }).join('');
}

/**
 * 获取进度状态对应的 CSS 类名
 */
function getProgressClass(status) {
  return (PROGRESS_STATUS[status] || PROGRESS_STATUS.pending).cssClass;
}

/**
 * 获取进度状态标签
 */
function getProgressLabel(status) {
  return (PROGRESS_STATUS[status] || PROGRESS_STATUS.pending).label;
}

/**
 * 获取工序中文名
 */
function getStepLabel(stepKey) {
  if (!stepKey) return '-';
  var found = PROCESS_STEPS.find(function (s) { return s.key === stepKey; });
  return found ? found.label : stepKey;
}

/**
 * 渲染列表内容（桌面表格 + 移动卡片）
 */
function renderListContent(plans) {
  var listContent = document.getElementById('listContent');
  if (!listContent) return;

  if (plans.length === 0) {
    listContent.innerHTML = '\
      <div class="empty-state">\
        <div class="icon">📋</div>\
        <div class="title">暂无生产计划</div>\
        <div class="desc">点击上方「生产计划录入」创建您的第一条计划</div>\
      </div>\
    ';
    return;
  }

  // 按创建时间倒序排列
  var sorted = plans.slice().sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  var statusLabels = {
    pending: '待生产',
    processing: '生产中',
    completed: '已完成',
    cancelled: '已取消'
  };
  var statusClasses = {
    pending: 'status-pending',
    processing: 'status-processing',
    completed: 'status-completed',
    cancelled: 'status-cancelled'
  };

  // 桌面端表格
  var tableHtml = '\
    <div class="desktop-table table-wrapper">\
      <table class="w-full text-sm">\
        <thead>\
          <tr class="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">\
            <th class="px-3 py-3 text-left">计划编号</th>\
            <th class="px-3 py-3 text-left">钢材类型</th>\
            <th class="px-3 py-3 text-left">规格</th>\
            <th class="px-3 py-3 text-right">数量</th>\
            <th class="px-3 py-3 text-center">当前工序</th>\
            <th class="px-3 py-3 text-center">进度状态</th>\
            <th class="px-3 py-3 text-left">交货日期</th>\
            <th class="px-3 py-3 text-center">状态</th>\
            <th class="px-3 py-3 text-left">客户</th>\
            <th class="px-3 py-3 text-center">操作</th>\
          </tr>\
        </thead>\
        <tbody class="divide-y divide-gray-100">\
  ';

  sorted.forEach(function (plan) {
    var progressClass = getProgressClass(plan.progressStatus);
    var progressLabel = getProgressLabel(plan.progressStatus);
    var stepLabel = getStepLabel(plan.processStep);

    tableHtml += '\
          <tr class="table-row-clickable hover:bg-gray-50 transition-colors" data-id="' + plan.id + '" onclick="openDetailModal(\'' + plan.id + '\')" title="点击查看订单详情">\
            <td class="px-3 py-3 font-medium text-gray-800">' + escapeHtml(plan.planNo) + '</td>\
            <td class="px-3 py-3 text-gray-600">' + escapeHtml(plan.steelType) + '</td>\
            <td class="px-3 py-3 text-gray-600">' + escapeHtml(plan.specification) + '</td>\
            <td class="px-3 py-3 text-right text-gray-800">' + plan.quantity + ' ' + escapeHtml(plan.unit) + '</td>\
            <td class="px-3 py-3 text-center text-gray-600 text-xs">' + escapeHtml(stepLabel) + '</td>\
            <td class="px-3 py-3 text-center">\
              <span class="progress-badge ' + progressClass + '">' + progressLabel + '</span>\
            </td>\
            <td class="px-3 py-3 text-gray-600">' + formatDate(plan.deliveryDate) + '</td>\
            <td class="px-3 py-3 text-center">\
              <span class="status-badge ' + (statusClasses[plan.status] || '') + '">' + (statusLabels[plan.status] || plan.status) + '</span>\
            </td>\
            <td class="px-3 py-3 text-gray-600">' + (plan.customer ? escapeHtml(plan.customer) : '<span class="text-gray-300">-</span>') + '</td>\
            <td class="px-3 py-3 text-center" onclick="event.stopPropagation()">\
              <div class="flex justify-center space-x-1">\
                <button class="text-green-600 hover:text-green-800 hover:bg-green-50 p-1.5 rounded transition-colors text-xs font-medium" onclick="openDetailModal(\'' + plan.id + '\')" title="查看详情">详情</button>\
                <button class="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded transition-colors text-xs font-medium" onclick="openEditModal(\'' + plan.id + '\')">编辑</button>\
                <button class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors text-xs font-medium" onclick="openDeleteModal(\'' + plan.id + '\')">删除</button>\
              </div>\
            </td>\
          </tr>\
    ';
  });

  tableHtml += '\
        </tbody>\
      </table>\
    </div>\
  ';

  // 移动端卡片
  var cardsHtml = '<div class="mobile-cards p-4">';
  sorted.forEach(function (plan) {
    var progressClass = getProgressClass(plan.progressStatus);
    var progressLabel = getProgressLabel(plan.progressStatus);
    var stepLabel = getStepLabel(plan.processStep);

    cardsHtml += '\
      <div class="card-hover mobile-card-clickable bg-white border border-gray-200 rounded-lg p-4" data-id="' + plan.id + '" onclick="openDetailModal(\'' + plan.id + '\')">\
        <div class="flex items-start justify-between mb-2">\
          <div class="font-semibold text-gray-800">' + escapeHtml(plan.planNo) + '</div>\
          <span class="status-badge ' + (statusClasses[plan.status] || '') + '">' + (statusLabels[plan.status] || plan.status) + '</span>\
        </div>\
        <div class="text-sm text-gray-600 space-y-1">\
          <div>📦 ' + escapeHtml(plan.steelType) + ' | ' + escapeHtml(plan.specification) + '</div>\
          <div>📊 数量: ' + plan.quantity + ' ' + escapeHtml(plan.unit) + '</div>\
          <div>🔧 工序: <span class="font-medium">' + escapeHtml(stepLabel) + '</span></div>\
          <div><span class="progress-badge ' + progressClass + '">' + progressLabel + '</span></div>\
          <div>📅 交货: ' + formatDate(plan.deliveryDate) + '</div>\
          ' + (plan.customer ? '<div>🏢 ' + escapeHtml(plan.customer) + '</div>' : '') + '\
          ' + (plan.remark ? '<div class="text-gray-400">💬 ' + escapeHtml(plan.remark) + '</div>' : '') + '\
        </div>\
        <div class="flex space-x-2 mt-3 pt-3 border-t border-gray-100" onclick="event.stopPropagation()">\
          <button class="flex-1 text-center text-green-600 hover:bg-green-50 py-2 rounded text-sm font-medium transition-colors" onclick="openDetailModal(\'' + plan.id + '\')">📋 详情</button>\
          <button class="flex-1 text-center text-blue-500 hover:bg-blue-50 py-2 rounded text-sm font-medium transition-colors" onclick="openEditModal(\'' + plan.id + '\')">✏️ 编辑</button>\
          <button class="flex-1 text-center text-red-500 hover:bg-red-50 py-2 rounded text-sm font-medium transition-colors" onclick="openDeleteModal(\'' + plan.id + '\')">🗑️ 删除</button>\
        </div>\
      </div>\
    ';
  });
  cardsHtml += '</div>';

  listContent.innerHTML = tableHtml + cardsHtml;
}

/**
 * 绑定列表筛选事件
 */
function bindListEvents() {
  var searchInput = document.getElementById('searchInput');
  var statusFilter = document.getElementById('statusFilter');
  if (!searchInput && !statusFilter) return;

  // 防抖定时器
  var searchTimer = null;

  var doSearch = function () {
    var keyword = (searchInput && searchInput.value || '').toLowerCase().trim();
    var status = statusFilter && statusFilter.value || 'all';

    var plans = getPlans();
    var filtered = plans.filter(function (plan) {
      if (status !== 'all' && plan.status !== status) return false;
      if (keyword) {
        var stepLabel = getStepLabel(plan.processStep);
        var progressLabel = getProgressLabel(plan.progressStatus);
        var statusLabel = (plan.status === 'pending' ? '待生产' : plan.status === 'processing' ? '生产中' : plan.status === 'completed' ? '已完成' : plan.status === 'cancelled' ? '已取消' : plan.status);
        var searchStr = (plan.planNo + ' ' + plan.steelType + ' ' + plan.specification + ' ' + plan.customer + ' ' + plan.remark + ' ' + stepLabel + ' ' + progressLabel + ' ' + statusLabel).toLowerCase();
        if (searchStr.indexOf(keyword) === -1) return false;
      }
      return true;
    });

    // 搜索反馈弹窗
    if (keyword) {
      if (filtered.length === 0) {
        showSearchResultModal('no_result', keyword, plans.length, status);
      } else {
        showSearchResultModal('found', keyword, filtered.length, status);
      }
    }

    renderProgressStats(filtered);
    renderStats(filtered);
    renderListContent(filtered);
  };

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 300);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (searchTimer) clearTimeout(searchTimer);
        doSearch();
      }
    });
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', function () {
      if (searchTimer) clearTimeout(searchTimer);
      doSearch();
    });
  }
}

/**
 * 刷新列表（供外部调用）
 */
function refreshList() {
  var listContent = document.getElementById('listContent');
  if (!listContent) return;

  var keyword = document.getElementById('searchInput');
  var statusFilter = document.getElementById('statusFilter');
  var kw = keyword ? keyword.value.toLowerCase().trim() : '';
  var st = statusFilter ? statusFilter.value : 'all';

  var plans = getPlans();
  var totalBefore = plans.length;
  var filtered = plans.filter(function (plan) {
    if (st !== 'all' && plan.status !== st) return false;
    if (kw) {
      var stepLabel = getStepLabel(plan.processStep);
      var progressLabel = getProgressLabel(plan.progressStatus);
      var statusLabel = (plan.status === 'pending' ? '待生产' : plan.status === 'processing' ? '生产中' : plan.status === 'completed' ? '已完成' : plan.status === 'cancelled' ? '已取消' : plan.status);
      var searchStr = (plan.planNo + ' ' + plan.steelType + ' ' + plan.specification + ' ' + plan.customer + ' ' + plan.remark + ' ' + stepLabel + ' ' + progressLabel + ' ' + statusLabel).toLowerCase();
      if (searchStr.indexOf(kw) === -1) return false;
    }
    return true;
  });

  renderProgressStats(filtered);
  renderStats(filtered);
  renderListContent(filtered);
}

// ==========================================
// 编辑弹窗
// ==========================================

/**
 * 打开编辑弹窗
 * @param {string|null} id - 计划 ID，null 为新建
 */
function openEditModal(id) {
  editingId = id;
  var modal = document.getElementById('editModal');
  var content = document.getElementById('editModalContent');
  if (!modal || !content) return;

  var plan = id ? getPlanById(id) : null;
  var isEdit = !!plan;

  var units = ['吨', '千克', '件', '米', '支'];

  // 生成工序选项
  var stepOptions = '<option value="">未指定</option>';
  PROCESS_STEPS.forEach(function (s) {
    var sel = (plan && plan.processStep === s.key) ? ' selected' : '';
    stepOptions += '<option value="' + s.key + '"' + sel + '>' + s.label + '</option>';
  });

  // 生成进度状态选项
  var progressOptions = '';
  var progressKeys = Object.keys(PROGRESS_STATUS);
  progressKeys.forEach(function (k) {
    var ps = PROGRESS_STATUS[k];
    var sel = (plan && plan.progressStatus === k) ? ' selected' : '';
    progressOptions += '<option value="' + k + '"' + sel + '>' + ps.label + '</option>';
  });

  content.innerHTML = '\
    <div class="p-6">\
      <div class="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">\
        <h3 class="text-lg font-bold text-gray-800">' + (isEdit ? '✏️ 编辑生产计划' : '➕ 新建生产计划') + '</h3>\
        <button class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1" onclick="closeEditModal()">&times;</button>\
      </div>\
      <form id="editForm" class="space-y-4" novalidate>\
        <div>\
          <label class="form-label">计划编号 <span class="text-red-500">*</span></label>\
          <input type="text" id="editPlanNo" class="form-input" value="' + escapeHtml(plan ? plan.planNo : '') + '" maxlength="50" />\
          <p class="form-error-msg" id="editPlanNoError">请输入计划编号</p>\
        </div>\
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">\
          <div>\
            <label class="form-label">钢材类型 <span class="text-red-500">*</span></label>\
            <input\
              type="text"\
              id="editSteelType"\
              class="form-input"\
              value="' + escapeHtml(plan ? plan.steelType : '') + '"\
              placeholder="输入钢材类型"\
              list="editSteelTypeList"\
              autocomplete="off"\
              maxlength="50"\
            />\
            <datalist id="editSteelTypeList">\
              ' + getSteelTypesDatalistHtml() + '\
            </datalist>\
            <p class="form-error-msg" id="editSteelTypeError">请输入钢材类型</p>\
          </div>\
          <div>\
            <label class="form-label">规格 <span class="text-red-500">*</span></label>\
            <input type="text" id="editSpecification" class="form-input" value="' + escapeHtml(plan ? plan.specification : '') + '" maxlength="100" />\
            <p class="form-error-msg" id="editSpecificationError">请输入规格</p>\
          </div>\
        </div>\
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">\
          <div>\
            <label class="form-label">数量 <span class="text-red-500">*</span></label>\
            <input type="number" id="editQuantity" class="form-input" value="' + (plan ? plan.quantity : '') + '" min="0.01" step="0.01" />\
            <p class="form-error-msg" id="editQuantityError">请输入有效的数量</p>\
          </div>\
          <div>\
            <label class="form-label">单位</label>\
            <select id="editUnit" class="form-select">\
              ' + units.map(function (u) { return '<option value="' + u + '"' + (plan && plan.unit === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '\
            </select>\
          </div>\
        </div>\
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">\
          <div>\
            <label class="form-label">当前工序</label>\
            <select id="editProcessStep" class="form-select">' + stepOptions + '</select>\
          </div>\
          <div>\
            <label class="form-label">进度状态</label>\
            <select id="editProgressStatus" class="form-select">' + progressOptions + '</select>\
          </div>\
        </div>\
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">\
          <div>\
            <label class="form-label">交货日期 <span class="text-red-500">*</span></label>\
            <input type="date" id="editDeliveryDate" class="form-input" value="' + (plan ? plan.deliveryDate : '') + '" />\
            <p class="form-error-msg" id="editDeliveryDateError">请选择交货日期</p>\
          </div>\
          <div>\
            <label class="form-label">状态</label>\
            <select id="editStatus" class="form-select">\
              <option value="pending"' + (plan && plan.status === 'pending' ? ' selected' : '') + '>待生产</option>\
              <option value="processing"' + (plan && plan.status === 'processing' ? ' selected' : '') + '>生产中</option>\
              <option value="completed"' + (plan && plan.status === 'completed' ? ' selected' : '') + '>已完成</option>\
              <option value="cancelled"' + (plan && plan.status === 'cancelled' ? ' selected' : '') + '>已取消</option>\
            </select>\
          </div>\
        </div>\
        <div>\
          <label class="form-label">客户</label>\
          <input type="text" id="editCustomer" class="form-input" value="' + escapeHtml(plan ? plan.customer : '') + '" maxlength="100" />\
        </div>\
        <div>\
          <label class="form-label">备注</label>\
          <textarea id="editRemark" class="form-textarea" rows="2" maxlength="500">' + escapeHtml(plan ? plan.remark : '') + '</textarea>\
        </div>\
        <div class="flex justify-end gap-3 pt-3 border-t border-gray-100">\
          <button type="button" class="btn-secondary" onclick="closeEditModal()">取消</button>\
          <button type="submit" class="btn-primary">' + (isEdit ? '💾 保存修改' : '✅ 创建计划') + '</button>\
        </div>\
      </form>\
    </div>\
  ';

  // 绑定编辑表单提交
  var editForm = document.getElementById('editForm');
  if (editForm) {
    editForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleEditSubmit();
    });
  }

  modal.classList.add('show');

  // 点击遮罩关闭
  modal.onclick = function (e) {
    if (e.target === modal) closeEditModal();
  };
}

/**
 * 关闭编辑弹窗
 */
function closeEditModal() {
  var modal = document.getElementById('editModal');
  if (modal) modal.classList.remove('show');
  editingId = null;
  isEditingSubmitting = false;
}

/**
 * 处理编辑表单提交
 */
function handleEditSubmit() {
  // 防止重复提交
  if (isEditingSubmitting) return;
  isEditingSubmitting = true;

  var data = {
    planNo: document.getElementById('editPlanNo').value.trim(),
    steelType: document.getElementById('editSteelType').value,
    specification: document.getElementById('editSpecification').value.trim(),
    quantity: document.getElementById('editQuantity').value,
    unit: document.getElementById('editUnit').value,
    deliveryDate: document.getElementById('editDeliveryDate').value,
    status: document.getElementById('editStatus').value,
    processStep: document.getElementById('editProcessStep').value,
    progressStatus: document.getElementById('editProgressStatus').value,
    customer: document.getElementById('editCustomer').value.trim(),
    remark: document.getElementById('editRemark').value.trim()
  };

  // 校验
  if (!validateEditForm(data)) {
    isEditingSubmitting = false;
    return;
  }

  try {
    if (editingId) {
      updatePlan(editingId, data);
      saveSteelTypeToHistory(data.steelType);
      showToast('计划更新成功！', 'success');
    } else {
      addPlan(data);
      saveSteelTypeToHistory(data.steelType);
      showToast('计划创建成功！', 'success');
    }
    closeEditModal();
    refreshList();
  } catch (err) {
    showToast('操作失败: ' + err.message, 'error');
  }

  isEditingSubmitting = false;
}

/**
 * 编辑表单校验
 */
function validateEditForm(data) {
  var valid = true;

  if (!data.planNo) { showFieldErrorById('editPlanNo'); valid = false; }
  if (!data.steelType) { showFieldErrorById('editSteelType'); valid = false; }
  if (!data.specification) { showFieldErrorById('editSpecification'); valid = false; }

  var qty = parseFloat(data.quantity);
  if (isNaN(qty) || qty <= 0) { showFieldErrorById('editQuantity'); valid = false; }

  if (!data.deliveryDate) { showFieldErrorById('editDeliveryDate'); valid = false; }

  return valid;
}

function showFieldErrorById(id) {
  var input = document.getElementById(id);
  var error = document.getElementById(id + 'Error');
  if (input) input.classList.add('error');
  if (error) error.classList.add('show');
}

// ==========================================
// 删除确认弹窗
// ==========================================

/**
 * 打开删除确认弹窗
 */
function openDeleteModal(id) {
  deletingId = id;
  var modal = document.getElementById('deleteModal');
  if (!modal) return;

  var plan = getPlanById(id);
  var msg = document.getElementById('deleteMessage');
  if (msg && plan) {
    msg.textContent = '确定要删除计划「' + plan.planNo + '」吗？此操作不可恢复。';
  }

  modal.classList.add('show');

  // 绑定确认按钮（先解绑再绑定，防止重复）
  var confirmBtn = document.getElementById('confirmDeleteBtn');
  if (confirmBtn) {
    confirmBtn.onclick = null;
    confirmBtn.onclick = function () {
      if (deletingId) {
        deletePlan(deletingId);
        showToast('计划已删除', 'info');
        closeDeleteModal();
        refreshList();
      }
    };
  }

  modal.onclick = function (e) {
    if (e.target === modal) closeDeleteModal();
  };
}

/**
 * 关闭删除确认弹窗
 */
function closeDeleteModal() {
  var modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('show');
  deletingId = null;
}

// ==========================================
// 进度管理弹窗（核心新增功能）
// ==========================================

/**
 * 构建当前筛选条件下的计划列表缓存（用于上一单/下一单导航）
 */
function buildProgressPlansCache() {
  var keyword = document.getElementById('searchInput');
  var statusFilter = document.getElementById('statusFilter');
  var kw = keyword ? keyword.value.toLowerCase().trim() : '';
  var st = statusFilter ? statusFilter.value : 'all';

  var plans = getPlans();
  progressPlansCache = plans.filter(function (plan) {
    if (st !== 'all' && plan.status !== st) return false;
    if (kw) {
      var stepLabel = getStepLabel(plan.processStep);
      var progressLabel = getProgressLabel(plan.progressStatus);
      var statusLabel = (plan.status === 'pending' ? '待生产' : plan.status === 'processing' ? '生产中' : plan.status === 'completed' ? '已完成' : plan.status === 'cancelled' ? '已取消' : plan.status);
      var searchStr = (plan.planNo + ' ' + plan.steelType + ' ' + plan.specification + ' ' + plan.customer + ' ' + plan.remark + ' ' + stepLabel + ' ' + progressLabel + ' ' + statusLabel).toLowerCase();
      if (searchStr.indexOf(kw) === -1) return false;
    }
    return true;
  });
}

/**
 * 打开进度管理弹窗
 * @param {string} id - 计划 ID
 */
function openProgressModal(id) {
  var modal = document.getElementById('progressModal');
  var content = document.getElementById('progressModalContent');
  if (!modal || !content) return;

  // 如果正在保存中，不允许切换
  if (isSavingProgress) return;

  progressPlanId = id;
  var plan;
  try {
    plan = getPlanById(id);
  } catch (e) {
    plan = null;
  }
  if (!plan) {
    showToast('未找到该计划，可能已被删除', 'error');
    return;
  }

  // 构建当前列表缓存
  buildProgressPlansCache();

  // 如果缓存为空（所有计划被删除），关闭弹窗
  if (progressPlansCache.length === 0) {
    showToast('当前列表中没有计划', 'info');
    closeProgressModal();
    return;
  }

  // 查找当前计划在缓存中的位置
  var currentIndex = progressPlansCache.findIndex(function (p) { return p.id === id; });
  if (currentIndex === -1) {
    showToast('该计划不在当前筛选范围内', 'warning');
    return;
  }

  // 当前工序索引
  var currentStepIndex = plan.processStep
    ? PROCESS_STEPS.findIndex(function (s) { return s.key === plan.processStep; })
    : -1;

  // 渲染工序步骤列表
  var stepsHtml = '';
  PROCESS_STEPS.forEach(function (step, idx) {
    var isActive = plan.processStep === step.key;
    var isCompleted = currentStepIndex !== -1 && idx < currentStepIndex;
    var stepClass = 'progress-step-item';
    if (isActive) stepClass += ' active';
    if (isCompleted && !isActive) stepClass += ' completed-step';

    stepsHtml += '\
      <div class="' + stepClass + '" data-step="' + step.key + '" onclick="selectProgressStep(event, \'' + step.key + '\')">\
        <div class="progress-step-dot"></div>\
        <div class="progress-step-name">' + step.label + '</div>\
      </div>\
    ';
  });

  // 进度状态选项按钮
  var progressKeys = Object.keys(PROGRESS_STATUS);
  var statusBtnsHtml = '';
  progressKeys.forEach(function (k) {
    var ps = PROGRESS_STATUS[k];
    var isSelected = plan.progressStatus === k;
    statusBtnsHtml += '\
      <button \
        class="' + (isSelected ? 'ring-2 ring-offset-1' : '') + ' px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all min-h-[44px]" \
        style="color:' + ps.color + '; border-color:' + (isSelected ? ps.color : '#e5e7eb') + '; background:' + (isSelected ? ps.bg : '#fff') + ';" \
        data-status="' + k + '" \
        onclick="selectProgressStatus(event, \'' + k + '\')"\
      >' + ps.label + '</button>\
    ';
  });

  // 操作日志
  var logs = plan.operationLogs || [];
  var logsHtml = '';
  if (logs.length > 0) {
    // 最近 10 条，倒序
    var recentLogs = logs.slice().reverse().slice(0, 10);
    logsHtml = '<div class="log-timeline">';
    recentLogs.forEach(function (log) {
      var timeStr = log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : '';
      logsHtml += '\
        <div class="log-item">\
          <div class="log-time">' + timeStr + '</div>\
          <div class="log-content">' + escapeHtml(log.action) + '</div>\
        </div>\
      ';
    });
    logsHtml += '</div>';
  } else {
    logsHtml = '<p class="text-gray-400 text-xs text-center py-2">暂无操作记录</p>';
  }

  // 上一单/下一单 导航
  var prevDisabled = currentIndex <= 0 ? ' disabled' : '';
  var nextDisabled = currentIndex >= progressPlansCache.length - 1 ? ' disabled' : '';
  var prevId = currentIndex > 0 ? progressPlansCache[currentIndex - 1].id : '';
  var nextId = currentIndex < progressPlansCache.length - 1 ? progressPlansCache[currentIndex + 1].id : '';

  content.innerHTML = '\
    <!-- 弹窗头部 -->\
    <div class="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">\
      <div class="flex items-center space-x-3">\
        <h3 class="text-lg font-bold text-gray-800">🔧 生产进度管理</h3>\
      </div>\
      <button class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1" onclick="closeProgressModal()">&times;</button>\
    </div>\
    \
    <!-- 订单信息摘要 -->\
    <div class="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">\
      <div class="flex flex-wrap items-center justify-between gap-2">\
        <div class="flex items-center space-x-3 flex-wrap">\
          <span class="font-bold text-gray-800">' + escapeHtml(plan.planNo) + '</span>\
          <span class="text-sm text-gray-500">' + escapeHtml(plan.steelType) + '</span>\
          <span class="text-sm text-gray-400">' + escapeHtml(plan.specification) + '</span>\
          <span class="text-sm text-gray-500">' + plan.quantity + ' ' + escapeHtml(plan.unit) + '</span>\
        </div>\
        <div class="flex items-center space-x-2">\
          <button class="progress-nav-btn" onclick="navigateProgress(\'' + prevId + '\')"' + prevDisabled + ' title="上一单">\
            ◀ 上一单\
          </button>\
          <span class="text-xs text-gray-400">' + (currentIndex + 1) + '/' + progressPlansCache.length + '</span>\
          <button class="progress-nav-btn" onclick="navigateProgress(\'' + nextId + '\')"' + nextDisabled + ' title="下一单">\
            下一单 ▶\
          </button>\
        </div>\
      </div>\
    </div>\
    \
    <!-- 弹窗主体（可滚动） -->\
    <div class="progress-modal-body p-5 overflow-y-auto">\
      \
      <!-- 工序步骤选择 -->\
      <div class="mb-5">\
        <h4 class="text-sm font-bold text-gray-700 mb-3">📋 当前工序</h4>\
        <div class="space-y-2" id="progressSteps">\
          ' + stepsHtml + '\
        </div>\
      </div>\
      \
      <!-- 进度状态选择 -->\
      <div class="mb-5">\
        <h4 class="text-sm font-bold text-gray-700 mb-3">🏷️ 进度状态</h4>\
        <div class="flex flex-wrap gap-2" id="progressStatusBtns">\
          ' + statusBtnsHtml + '\
        </div>\
      </div>\
      \
      <!-- 操作日志 -->\
      <div class="mb-2">\
        <details>\
          <summary class="text-sm font-bold text-gray-700 mb-2 cursor-pointer select-none">📜 操作记录</summary>\
          <div class="mt-2 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto" id="operationLogs">\
            ' + logsHtml + '\
          </div>\
        </details>\
      </div>\
      \
    </div>\
    \
    <!-- 弹窗底部按钮 -->\
    <div class="flex justify-between items-center p-5 border-t border-gray-100 flex-shrink-0">\
      <button class="btn-secondary" onclick="closeProgressModal()">关闭</button>\
      <button class="progress-save-btn btn-primary" id="saveProgressBtn" onclick="saveProgress()">\
        💾 保存进度\
      </button>\
    </div>\
  ';

  // 重置选中状态 + 记录原始值（用于判断是否有未保存修改）
  pendingProgressStep = plan.processStep || '';
  pendingProgressStatus = plan.progressStatus || 'pending';
  originalProgressStep = plan.processStep || '';
  originalProgressStatus = plan.progressStatus || 'pending';

  modal.classList.add('show');

  // 点击遮罩关闭
  modal.onclick = function (e) {
    if (e.target === modal) closeProgressModal();
  };
}

/**
 * 在进度弹窗中选择工序
 */
function selectProgressStep(event, stepKey) {
  event.stopPropagation();
  pendingProgressStep = stepKey;

  // 更新步骤列表高亮
  var steps = document.querySelectorAll('#progressSteps .progress-step-item');
  steps.forEach(function (el) {
    var s = el.getAttribute('data-step');
    el.classList.remove('active', 'completed-step');

    var stepIdx = PROCESS_STEPS.findIndex(function (step) { return step.key === s; });
    var selectedIdx = PROCESS_STEPS.findIndex(function (step) { return step.key === stepKey; });

    if (s === stepKey) {
      el.classList.add('active');
    } else if (stepIdx < selectedIdx) {
      el.classList.add('completed-step');
    }
  });
}

/**
 * 在进度弹窗中选择进度状态
 */
function selectProgressStatus(event, statusKey) {
  event.stopPropagation();
  pendingProgressStatus = statusKey;

  // 更新状态按钮高亮
  var btns = document.querySelectorAll('#progressStatusBtns button');
  btns.forEach(function (btn) {
    var ps = PROGRESS_STATUS[btn.getAttribute('data-status')];
    if (btn.getAttribute('data-status') === statusKey) {
      btn.className = 'ring-2 ring-offset-1 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all min-h-[44px]';
      btn.style.cssText = 'color:' + ps.color + '; border-color:' + ps.color + '; background:' + ps.bg + ';';
    } else {
      ps = PROGRESS_STATUS[btn.getAttribute('data-status')];
      btn.className = 'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all min-h-[44px]';
      btn.style.cssText = 'color:' + ps.color + '; border-color:#e5e7eb; background:#fff;';
    }
  });
}

/**
 * 上一单/下一单导航
 */
function navigateProgress(targetId) {
  if (!targetId) return;
  // 检查是否有未保存的修改
  if (hasUnsavedChanges()) {
    showToast('请先保存当前修改，再切换订单', 'warning');
    return;
  }
  openProgressModal(targetId);
}

/**
 * 检查进度弹窗中是否有未保存的修改
 * @returns {boolean}
 */
function hasUnsavedChanges() {
  return pendingProgressStep !== originalProgressStep || pendingProgressStatus !== originalProgressStatus;
}

/**
 * 保存进度 → 弹出二次确认弹窗
 */
function saveProgress() {
  if (!progressPlanId) return;

  var plan = getPlanById(progressPlanId);
  if (!plan) return;

  var stepLabel = getStepLabel(pendingProgressStep);
  var statusLabel = getProgressLabel(pendingProgressStatus);
  var oldStepLabel = getStepLabel(plan.processStep);
  var oldStatusLabel = getProgressLabel(plan.progressStatus);

  // 如果没有任何改变，不弹确认
  if (pendingProgressStep === plan.processStep && pendingProgressStatus === plan.progressStatus) {
    showToast('进度未发生变化，无需保存', 'info');
    return;
  }

  // 设置二次确认弹窗内容
  var confirmMsg = document.getElementById('confirmProgressMsg');
  var confirmDetail = document.getElementById('confirmProgressDetail');
  if (confirmMsg) {
    confirmMsg.textContent = '确认修改订单「' + plan.planNo + '」的工序进度吗？';
  }
  if (confirmDetail) {
    confirmDetail.innerHTML = '\
      <div class="space-y-1 text-sm">\
        <div>工序: <span class="text-gray-400 line-through">' + escapeHtml(oldStepLabel) + '</span> → <span class="font-bold text-blue-600">' + escapeHtml(stepLabel) + '</span></div>\
        <div>状态: <span class="text-gray-400 line-through">' + escapeHtml(oldStatusLabel) + '</span> → <span class="font-bold text-blue-600">' + escapeHtml(statusLabel) + '</span></div>\
      </div>\
    ';
  }

  // 绑定确认按钮（先解绑再绑定，防止重复）
  var confirmBtn = document.getElementById('confirmProgressBtn');
  if (confirmBtn) {
    confirmBtn.onclick = null;
    confirmBtn.onclick = function () {
      executeProgressSave();
    };
  }

  // 显示二次确认弹窗
  var confirmModal = document.getElementById('confirmProgressModal');
  if (confirmModal) {
    confirmModal.classList.add('show');
    confirmModal.onclick = function (e) {
      if (e.target === confirmModal) closeConfirmProgressModal();
    };
  }
}

/**
 * 执行进度保存（二次确认后调用）
 */
function executeProgressSave() {
  if (!progressPlanId || isSavingProgress) return;
  isSavingProgress = true;

  try {
    var plan = getPlanById(progressPlanId);
    if (!plan) {
      showToast('计划不存在，可能已被删除', 'error');
      closeConfirmProgressModal();
      closeProgressModal();
      refreshList();
      isSavingProgress = false;
      return;
    }

    var oldStep = plan.processStep || '';
    var oldStatus = plan.progressStatus || 'pending';

    // 先更新计划数据
    var updated = updatePlan(progressPlanId, {
      processStep: pendingProgressStep,
      progressStatus: pendingProgressStatus
    });

    if (!updated) {
      showToast('更新失败，请重试', 'error');
      isSavingProgress = false;
      return;
    }

    // 再追加操作日志（此时 updatePlan 已生效，getPlanById 会读到最新数据）
    var logAction = '';
    if (oldStep !== pendingProgressStep) {
      logAction += '工序: ' + getStepLabel(oldStep) + ' → ' + getStepLabel(pendingProgressStep) + '; ';
    }
    if (oldStatus !== pendingProgressStatus) {
      logAction += '进度: ' + getProgressLabel(oldStatus) + ' → ' + getProgressLabel(pendingProgressStatus);
    }
    addOperationLog(progressPlanId, {
      action: logAction || '更新进度',
      from: oldStep + '|' + oldStatus,
      to: pendingProgressStep + '|' + pendingProgressStatus,
      field: 'progress'
    });

    // 更新原始值
    originalProgressStep = pendingProgressStep;
    originalProgressStatus = pendingProgressStatus;

    showToast('进度保存成功！', 'success');

    // 关闭二次确认弹窗
    closeConfirmProgressModal();

    // 刷新进度弹窗内容
    openProgressModal(progressPlanId);

    // 刷新列表
    refreshList();
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }

  isSavingProgress = false;
}

/**
 * 关闭进度弹窗
 */
function closeProgressModal() {
  var modal = document.getElementById('progressModal');
  if (modal) modal.classList.remove('show');
  progressPlanId = null;
  pendingProgressStep = null;
  pendingProgressStatus = null;
  originalProgressStep = null;
  originalProgressStatus = null;
  isSavingProgress = false;
}

/**
 * 关闭进度二次确认弹窗
 */
function closeConfirmProgressModal() {
  var modal = document.getElementById('confirmProgressModal');
  if (modal) modal.classList.remove('show');
}

// ==========================================
// 数据导入
// ==========================================

/**
 * 处理文件导入
 */
function handleImport(event) {
  var file = event.target.files[0];
  if (!file) return;

  importData(file).then(function (count) {
    showToast('成功导入 ' + count + ' 条记录', 'success');
    refreshList();
  }).catch(function (err) {
    showToast(err.message, 'error');
  });

  event.target.value = '';
}

// ==========================================
// 工具函数
// ==========================================

/**
 * 格式化日期显示
 * @param {string} dateStr - ISO 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  var parts = dateStr.split('-');
  if (parts.length === 3) {
    return parts[0] + '/' + parts[1] + '/' + parts[2];
  }
  return dateStr;
}

/**
 * 导出 JSON 数据（包装 showToast）
 */
function handleExportData() {
  var result = exportData();
  if (result && result.success) {
    showToast('JSON 导出成功！共 ' + result.count + ' 条记录', 'success');
  } else if (result && result.message) {
    showToast(result.message, 'warning');
  }
}

/**
 * 导出 Excel (CSV) — 对账报表（包装 showToast）
 */
function handleExportExcel() {
  var result = exportExcel();
  if (result && result.success) {
    showToast(result.message, 'success');
  } else if (result && result.message) {
    showToast(result.message, 'warning');
  }
}

// ==========================================
// 搜索反馈弹窗
// ==========================================

/**
 * 显示搜索结果弹窗
 * @param {string} type - 'no_result' | 'found' | 'no_status'
 * @param {string} keyword - 搜索关键词
 * @param {number} count - 结果数量
 * @param {string} status - 当前状态筛选值
 */
function showSearchResultModal(type, keyword, count, status) {
  var modal = document.getElementById('searchResultModal');
  var content = document.getElementById('searchResultContent');
  if (!modal || !content) return;

  var statusLabels = {
    all: '全部状态',
    pending: '待生产',
    processing: '生产中',
    completed: '已完成',
    cancelled: '已取消'
  };
  var statusLabel = statusLabels[status] || '全部状态';

  var icon, title, detail;

  if (type === 'no_result') {
    icon = '🔍';
    title = '未查询到结果';
    detail = '关键词「<b>' + escapeHtml(keyword) + '</b>」在 <b>' + statusLabel + '</b> 中未找到匹配的生产计划。<br>请尝试修改搜索条件或检查关键字是否正确。';
  } else if (type === 'no_status') {
    icon = '📋';
    title = '暂无数据';
    detail = '当前「<b>' + statusLabel + '</b>」分类下没有生产计划记录。';
  } else {
    icon = '✅';
    title = '查询结果';
    detail = '关键词「<b>' + escapeHtml(keyword) + '</b>」在 <b>' + statusLabel + '</b> 中<br>共找到 <span class="text-blue-600 font-bold text-lg">' + count + '</span> 条匹配的生产计划。';
  }

  content.innerHTML = '\
    <div class="text-5xl mb-4">' + icon + '</div>\n\
    <h3 class="text-lg font-bold text-gray-800 mb-3">' + title + '</h3>\n\
    <p class="text-gray-600 text-sm leading-relaxed mb-5">' + detail + '</p>\n\
    <button class="px-6 py-2.5 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors min-h-[44px]" onclick="closeSearchResultModal()">\n\
      确定\n\
    </button>\n\
  ';

  modal.classList.add('show');
  modal.onclick = function (e) {
    if (e.target === modal) closeSearchResultModal();
  };
}

/**
 * 关闭搜索反馈弹窗
 */
function closeSearchResultModal() {
  var modal = document.getElementById('searchResultModal');
  if (modal) modal.classList.remove('show');
}

// ==========================================
// 三级详情弹窗（生产进度 + 财务模块）
// ==========================================

/**
 * 打开订单三级详情弹窗
 * @param {string} id - 计划 ID
 */
function openDetailModal(id) {
  var modal = document.getElementById('detailModal');
  var content = document.getElementById('detailModalContent');
  if (!modal || !content) return;

  detailPlanId = id;
  isDetailSaving = false;
  var plan;
  try {
    plan = getPlanById(id);
  } catch (e) {
    plan = null;
  }
  if (!plan) {
    showToast('未找到该计划', 'error');
    return;
  }

  // --- 构建进度管理区 ---
  // 工序步骤
  var stepsHtml = '';
  var currentStepIndex = plan.processStep
    ? PROCESS_STEPS.findIndex(function (s) { return s.key === plan.processStep; })
    : -1;
  PROCESS_STEPS.forEach(function (step, idx) {
    var isActive = plan.processStep === step.key;
    var isCompleted = currentStepIndex !== -1 && idx < currentStepIndex;
    var stepClass = 'progress-step-item';
    if (isActive) stepClass += ' active';
    if (isCompleted && !isActive) stepClass += ' completed-step';
    stepsHtml += '\
      <div class="' + stepClass + '" data-step="' + step.key + '" onclick="detailSelectStep(event, \'' + step.key + '\')">\
        <div class="progress-step-dot"></div>\
        <div class="progress-step-name">' + step.label + '</div>\
      </div>\
    ';
  });

  // 进度状态按钮
  var progressKeys = Object.keys(PROGRESS_STATUS);
  var statusBtnsHtml = '';
  progressKeys.forEach(function (k) {
    var ps = PROGRESS_STATUS[k];
    var isSelected = plan.progressStatus === k;
    statusBtnsHtml += '\
      <button \
        class="' + (isSelected ? 'ring-2 ring-offset-1' : '') + ' px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all min-h-[44px]" \
        style="color:' + ps.color + '; border-color:' + (isSelected ? ps.color : '#e5e7eb') + '; background:' + (isSelected ? ps.bg : '#fff') + ';" \
        data-status="' + k + '" \
        onclick="detailSelectStatus(event, \'' + k + '\')"\
      >' + ps.label + '</button>\
    ';
  });

  // 操作日志
  var logs = plan.operationLogs || [];
  var logsHtml = '';
  if (logs.length > 0) {
    var recentLogs = logs.slice().reverse().slice(0, 10);
    logsHtml = '<div class="log-timeline">';
    recentLogs.forEach(function (log) {
      var timeStr = log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : '';
      logsHtml += '\
        <div class="log-item">\
          <div class="log-time">' + timeStr + '</div>\
          <div class="log-content">' + escapeHtml(log.action) + '</div>\
        </div>\
      ';
    });
    logsHtml += '</div>';
  } else {
    logsHtml = '<p class="text-gray-400 text-xs text-center py-2">暂无操作记录</p>';
  }

  // --- 构建财务模块 ---
  var settleLabel = getSettleLabel(plan.settleStatus || 'unsettled');
  var settleColor = getSettleColor(plan.settleStatus || 'unsettled');
  var settleBg = getSettleBg(plan.settleStatus || 'unsettled');

  // 财务操作日志
  var fLogs = plan.financeLogs || [];
  var fLogsHtml = '';
  if (fLogs.length > 0) {
    var recentFLogs = fLogs.slice().reverse().slice(0, 10);
    fLogsHtml = '<div class="log-timeline">';
    recentFLogs.forEach(function (log) {
      var timeStr = log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : '';
      fLogsHtml += '\
        <div class="log-item">\
          <div class="log-time">' + timeStr + '</div>\
          <div class="log-content">' + escapeHtml(log.action + (log.detail ? ': ' + log.detail : '')) + '</div>\
        </div>\
      ';
    });
    fLogsHtml += '</div>';
  } else {
    fLogsHtml = '<p class="text-gray-400 text-xs text-center py-2">暂无财务操作记录</p>';
  }

  content.innerHTML = '\
    <!-- 弹窗头部 -->\
    <div class="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">\
      <div class="flex items-center space-x-3">\
        <h3 class="text-lg font-bold text-gray-800">📋 订单详情</h3>\
        <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">' + escapeHtml(plan.planNo) + '</span>\
      </div>\
      <button class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1" onclick="closeDetailModal()">&times;</button>\
    </div>\
    \
    <!-- 订单基本信息 -->\
    <div class="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">\
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">\
        <span class="font-medium text-gray-700">📦 ' + escapeHtml(plan.steelType) + '</span>\
        <span class="text-gray-500">规格: ' + escapeHtml(plan.specification) + '</span>\
        <span class="text-gray-500">数量: ' + plan.quantity + ' ' + escapeHtml(plan.unit) + '</span>\
        <span class="text-gray-500">📅 ' + formatDate(plan.deliveryDate) + '</span>\
        ' + (plan.customer ? '<span class="text-gray-500">🏢 ' + escapeHtml(plan.customer) + '</span>' : '') + '\
        <span class="status-badge ' + (plan.status === 'pending' ? 'status-pending' : plan.status === 'processing' ? 'status-processing' : plan.status === 'completed' ? 'status-completed' : 'status-cancelled') + '">' + (plan.status === 'pending' ? '待生产' : plan.status === 'processing' ? '生产中' : plan.status === 'completed' ? '已完成' : '已取消') + '</span>\
      </div>\
    </div>\
    \
    <!-- 弹窗主体（可滚动，双栏布局） -->\
    <div class="detail-modal-body p-5 overflow-y-auto">\
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">\
        \
        <!-- ===== 左侧：生产进度管理 ===== -->\
        <div class="detail-section">\
          <div class="detail-section-header">\
            <span class="text-base font-bold text-gray-700">🔧 生产进度</span>\
          </div>\
          \
          <!-- 工序选择 -->\
          <div class="mb-4">\
            <h4 class="text-sm font-bold text-gray-600 mb-2">📋 当前工序</h4>\
            <div class="space-y-1.5" id="detailProgressSteps">\
              ' + stepsHtml + '\
            </div>\
          </div>\
          \
          <!-- 进度状态选择 -->\
          <div class="mb-4">\
            <h4 class="text-sm font-bold text-gray-600 mb-2">🏷️ 进度状态</h4>\
            <div class="flex flex-wrap gap-2" id="detailProgressStatusBtns">\
              ' + statusBtnsHtml + '\
            </div>\
          </div>\
          \
          <!-- 进度保存按钮 -->\
          <div class="mb-4">\
            <button class="btn-primary w-full py-2.5" id="detailSaveProgressBtn" onclick="detailSaveProgress()">\
              💾 保存生产进度\
            </button>\
          </div>\
          \
          <!-- 操作日志 -->\
          <div>\
            <details>\
              <summary class="text-sm font-bold text-gray-600 mb-2 cursor-pointer select-none">📜 生产操作记录</summary>\
              <div class="mt-2 bg-gray-50 rounded-lg p-3 max-h-36 overflow-y-auto">\
                ' + logsHtml + '\
              </div>\
            </details>\
          </div>\
        </div>\
        \
        <!-- ===== 右侧：财务管理 ===== -->\
        <div class="detail-section">\
          <div class="detail-section-header">\
            <span class="text-base font-bold text-gray-700">💰 财务管理</span>\
            <span class="settle-badge ' + getSettleClass(plan.settleStatus || 'unsettled') + '">' + settleLabel + '</span>\
          </div>\
          \
          <div class="space-y-3">\
            <!-- 钢材单价 -->\
            <div>\
              <label class="form-label text-xs">钢材单价（元/' + escapeHtml(plan.unit) + '）</label>\
              <input type="number" id="detailUnitPrice" class="form-input" value="' + (plan.unitPrice || '') + '" min="0" step="0.01" placeholder="输入单价" onchange="detailAutoCalcTotal()" />\
            </div>\
            \
            <!-- 自动计算：单吨总价 -->\
            <div class="bg-gray-50 rounded-lg p-3">\
              <div class="flex items-center justify-between">\
                <span class="text-sm text-gray-500">单吨总价</span>\
                <span class="text-lg font-bold text-blue-600" id="detailTotalPrice">' + formatMoney(plan.totalPrice || 0) + ' 元</span>\
              </div>\
              <div class="text-xs text-gray-400 mt-1">= 单价 × 数量(' + plan.quantity + ')</div>\
            </div>\
            \
            <!-- 已收金额（多次回款记录） -->            <div>              <div class="flex items-center justify-between mb-1.5">                <label class="form-label text-xs mb-0">回款记录</label>                <span class="text-xs font-bold" style="color:#16a34a;" id="detailReceivedTotal">¥0.00</span>              </div>              <div class="bg-gray-50 rounded-lg p-2 mb-2 max-h-32 overflow-y-auto" id="detailPaymentRecords">                <div class="text-xs text-gray-400 text-center py-2">暂无回款记录</div>              </div>              <!-- 新增回款 -->              <div class="flex gap-2 items-end flex-wrap">                <div class="flex-1 min-w-[80px]">                  <label class="text-xs text-gray-400">金额（元）</label>                  <input type="number" id="detailNewPmtAmount" class="form-input text-sm" min="0.01" step="0.01" placeholder="0.00" />                </div>                <div class="w-28">                  <label class="text-xs text-gray-400">日期</label>                  <input type="date" id="detailNewPmtDate" class="form-input text-sm" />                </div>                <div class="w-24">                  <label class="text-xs text-gray-400">方式</label>                  <select id="detailNewPmtMethod" class="form-select text-sm">                    <option value="银行转账">银行转账</option>                    <option value="现金">现金</option>                    <option value="微信">微信</option>                    <option value="支付宝">支付宝</option>                    <option value="支票">支票</option>                    <option value="其他">其他</option>                  </select>                </div>                <button class="btn-primary text-xs py-2 px-3 flex-shrink-0" onclick="detailAddPayment()" style="min-height:38px;">➕ 录入</button>              </div>            </div>                        <!-- 未收欠款 -->            <div class="bg-red-50 rounded-lg p-3" id="detailUnpaidBox">              <div class="flex items-center justify-between">                <span class="text-sm text-gray-500">未收欠款</span>                <span class="text-lg font-bold text-red-600" id="detailUnpaidAmount">¥0.00</span>              </div>            </div>                        <!-- 对账备注 -->            <div>              <label class="form-label text-xs">对账备注</label>              <textarea id="detailFinanceRemark" class="form-textarea" rows="2" maxlength="200" placeholder="记录对账信息..."></textarea>            </div>            <!-- 财务保存按钮 -->            <button class="btn-primary w-full py-2.5 mt-3" onclick="detailSaveFinance()">💰 保存财务数据</button>\
          </div>\
          \
          <!-- 财务操作日志 -->\
          <div class="mt-4">\
            <details>\
              <summary class="text-sm font-bold text-gray-600 mb-2 cursor-pointer select-none">📜 财务操作记录</summary>\
              <div class="mt-2 bg-gray-50 rounded-lg p-3 max-h-36 overflow-y-auto">\
                ' + fLogsHtml + '\
              </div>\
            </details>\
          </div>\
        </div>\
        \
      </div>\
    </div>\
    \
    <!-- 弹窗底部按钮 -->\
    <div class="flex justify-between items-center p-5 border-t border-gray-100 flex-shrink-0">\
      <div class="flex space-x-2">\
        <button class="btn-secondary text-sm" onclick="openEditModal(\'' + plan.id + '\')">✏️ 编辑</button>\
        <button class="btn-secondary text-sm" onclick="openDeleteModal(\'' + plan.id + '\')">🗑️ 删除</button>\
      </div>\
      <div class="flex space-x-2">\
        <button class="btn-primary text-sm" onclick="closeDetailModal(); openFinanceTableModal()">💰 财务对账</button>\
        <button class="btn-secondary" onclick="closeDetailModal()">关闭</button>\
      </div>\
    </div>\
  ';

  // 初始化选中状态
  pendingProgressStep = plan.processStep || '';
  pendingProgressStatus = plan.progressStatus || 'pending';

  // 初始化工序进度条
  setTimeout(function () { updateDetailProgressBar(plan.processStep || ''); }, 100);

  // 初始化回款记录渲染
  setTimeout(function () {
    var recordsContainer = document.getElementById('detailPaymentRecords');
    if (recordsContainer) {
      recordsContainer.innerHTML = buildPaymentRecordsHtml(plan);
    }
    // 初始化回款日期默认值
    var dateEl = document.getElementById('detailNewPmtDate');
    if (dateEl) {
      var today = new Date();
      dateEl.value = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    }
    // 更新已收总额显示
    var records = plan.paymentRecords || [];
    var totalReceived = 0;
    records.forEach(function (r) { totalReceived += Number(r.amount) || 0; });
    var totalEl = document.getElementById('detailReceivedTotal');
    if (totalEl) totalEl.textContent = '已收总计: ¥' + formatMoney(totalReceived);
  }, 150);

  // 关闭页面滚动
  document.body.classList.add('modal-open');
  modal.classList.add('show');
  modal.onclick = function (e) {
    if (e.target === modal) closeDetailModal();
  };
}

/**
 * 关闭三级详情弹窗
 */
function closeDetailModal() {
  var modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('show');
  detailPlanId = null;
  isDetailSaving = false;
  document.body.classList.remove('modal-open');
}

/**
 * 详情弹窗中工序选择
 */
function detailSelectStep(event, stepKey) {
  event.stopPropagation();
  pendingProgressStep = stepKey;
  var steps = document.querySelectorAll('#detailProgressSteps .progress-step-item');
  steps.forEach(function (el) {
    var s = el.getAttribute('data-step');
    el.classList.remove('active', 'completed-step');
    var stepIdx = PROCESS_STEPS.findIndex(function (st) { return st.key === s; });
    var selectedIdx = PROCESS_STEPS.findIndex(function (st) { return st.key === stepKey; });
    if (s === stepKey) {
      el.classList.add('active');
    } else if (stepIdx < selectedIdx) {
      el.classList.add('completed-step');
    }
  });
  // 更新工序进度条
  updateDetailProgressBar(stepKey);
}

/**
 * 详情弹窗中进度状态选择
 */
function detailSelectStatus(event, statusKey) {
  event.stopPropagation();
  pendingProgressStatus = statusKey;
  var btns = document.querySelectorAll('#detailProgressStatusBtns button');
  btns.forEach(function (btn) {
    var ps = PROGRESS_STATUS[btn.getAttribute('data-status')];
    if (btn.getAttribute('data-status') === statusKey) {
      btn.className = 'ring-2 ring-offset-1 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all min-h-[44px]';
      btn.style.cssText = 'color:' + ps.color + '; border-color:' + ps.color + '; background:' + ps.bg + ';';
    } else {
      btn.className = 'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all min-h-[44px]';
      btn.style.cssText = 'color:' + ps.color + '; border-color:#e5e7eb; background:#fff;';
    }
  });
}

/**
 * 详情弹窗中保存生产进度
 */
function detailSaveProgress() {
  if (!detailPlanId || isDetailSaving) return;
  isDetailSaving = true;

  try {
    var plan = getPlanById(detailPlanId);
    if (!plan) {
      showToast('计划不存在', 'error');
      isDetailSaving = false;
      return;
    }

    if (pendingProgressStep === (plan.processStep || '') && pendingProgressStatus === (plan.progressStatus || 'pending')) {
      showToast('进度未发生变化，无需保存', 'info');
      isDetailSaving = false;
      return;
    }

    var oldStep = plan.processStep || '';
    var oldStatus = plan.progressStatus || 'pending';

    var updated = updatePlan(detailPlanId, {
      processStep: pendingProgressStep,
      progressStatus: pendingProgressStatus
    });

    if (!updated) {
      showToast('更新失败', 'error');
      isDetailSaving = false;
      return;
    }

    var logAction = '';
    if (oldStep !== pendingProgressStep) {
      logAction += '工序: ' + getStepLabel(oldStep) + ' → ' + getStepLabel(pendingProgressStep) + '; ';
    }
    if (oldStatus !== pendingProgressStatus) {
      logAction += '进度: ' + getProgressLabel(oldStatus) + ' → ' + getProgressLabel(pendingProgressStatus);
    }
    addOperationLog(detailPlanId, {
      action: logAction || '更新进度',
      from: oldStep + '|' + oldStatus,
      to: pendingProgressStep + '|' + pendingProgressStatus,
      field: 'progress'
    });

    showToast('生产进度保存成功！', 'success');
    refreshList();
    openDetailModal(detailPlanId);
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }

  isDetailSaving = false;
}

/**
 * 详情弹窗中自动计算总价和未收欠款
 */
function detailAutoCalcTotal() {
  var unitPriceEl = document.getElementById('detailUnitPrice');
  var receivedEl = document.getElementById('detailReceivedAmount');
  var totalEl = document.getElementById('detailTotalPrice');
  var unpaidEl = document.getElementById('detailUnpaidAmount');
  var unpaidBox = document.getElementById('detailUnpaidBox');

  if (!detailPlanId) return;
  var plan = getPlanById(detailPlanId);
  if (!plan) return;

  var unitPrice = unitPriceEl ? parseFloat(unitPriceEl.value) || 0 : 0;
  var received = receivedEl ? parseFloat(receivedEl.value) || 0 : 0;
  var quantity = Number(plan.quantity) || 0;
  var totalPrice = unitPrice * quantity;
  var unpaid = totalPrice - received;
  if (unpaid < 0) unpaid = 0;

  if (totalEl) totalEl.textContent = formatMoney(totalPrice) + ' 元';
  if (unpaidEl) unpaidEl.textContent = formatMoney(unpaid) + ' 元';

  // 欠款区域颜色变化
  if (unpaidBox) {
    if (unpaid <= 0 && totalPrice > 0) {
      unpaidBox.className = 'bg-green-50 rounded-lg p-3';
    } else if (unpaid > 0) {
      unpaidBox.className = 'bg-red-50 rounded-lg p-3';
    } else {
      unpaidBox.className = 'bg-gray-50 rounded-lg p-3';
    }
  }
}



/**
 * 格式化金额显示
 * @param {number} amount
 * @returns {string}
 */
function formatMoney(amount) {
  var num = Number(amount) || 0;
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 导出财务账单（包装 showToast）
 */
function handleExportFinanceExcel() {
  var result = exportFinanceExcel();
  if (result && result.success) {
    showToast(result.message, 'success');
  } else if (result && result.message) {
    showToast(result.message, 'warning');
  }
}

// ==========================================
// 财务对账表格弹窗（在线编辑计算，确认后导出Excel）
// ==========================================

/** 财务表格缓存（用于记录修改） */
var financeTableCache = {};

/**
 * 打开财务对账表格弹窗
 */
function openFinanceTableModal() {
  var modal = document.getElementById('financeTableModal');
  var content = document.getElementById('financeTableModalContent');
  if (!modal || !content) return;

  var plans = getPlans();
  if (plans.length === 0) {
    showToast('暂无数据，请先录入生产计划', 'warning');
    return;
  }

  // 按创建时间倒序
  var sorted = plans.slice().sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // 初始化缓存
  financeTableCache = {};
  sorted.forEach(function (plan) {
    financeTableCache[plan.id] = {
      unitPrice: plan.unitPrice || 0,
      receivedAmount: plan.receivedAmount || 0,
      financeRemark: plan.financeRemark || ''
    };
  });

  // 构建表头
  var headers = [
    '计划编号', '钢材类型', '规格', '数量',
    '单价(元)', '总价(元)', '已收(元)', '未收(元)',
    '结算状态', '对账备注'
  ];

  // 构建表格行
  var rowsHtml = '';
  sorted.forEach(function (plan) {
    var unitPrice = plan.unitPrice || 0;
    var totalPrice = plan.totalPrice || 0;
    var received = plan.receivedAmount || 0;
    var unpaid = plan.unpaidAmount || 0;
    var settleLabel = getSettleLabel(plan.settleStatus || 'unsettled');
    var settleColor = getSettleColor(plan.settleStatus || 'unsettled');
    var settleBg = getSettleBg(plan.settleStatus || 'unsettled');

    rowsHtml += '\
      <tr data-id="' + plan.id + '">\n\
        <td class="font-medium text-gray-800 whitespace-nowrap">' + escapeHtml(plan.planNo) + '</td>\n\
        <td class="text-gray-600 whitespace-nowrap max-w-[120px] truncate" title="' + escapeHtml(plan.steelType) + '">' + escapeHtml(plan.steelType) + '</td>\n\
        <td class="text-gray-600 whitespace-nowrap max-w-[100px] truncate" title="' + escapeHtml(plan.specification) + '">' + escapeHtml(plan.specification) + '</td>\n\
        <td class="text-center text-gray-700 whitespace-nowrap">' + plan.quantity + ' ' + escapeHtml(plan.unit) + '</td>\n\
        <td class="text-center">\n\
          <input type="number" class="finance-table-input" \n\
            data-id="' + plan.id + '" data-field="unitPrice" \n\
            value="' + (unitPrice || '') + '" \n\
            min="0" step="0.01" placeholder="0.00"\n\
            onchange="financeTableCellChanged(this)"\n\
            onfocus="financeTableCellFocus(this)" />\n\
        </td>\n\
        <td class="finance-calc-cell ' + (totalPrice > 0 ? 'positive' : 'zero') + '" id="ftTotal_' + plan.id + '">' + formatMoney(totalPrice) + '</td>\n\
        <td class="text-center">\n\
          <input type="number" class="finance-table-input" \n\
            data-id="' + plan.id + '" data-field="receivedAmount" \n\
            value="' + (received || '') + '" \n\
            min="0" step="0.01" placeholder="0.00"\n\
            onchange="financeTableCellChanged(this)"\n\
            onfocus="financeTableCellFocus(this)" />\n\
        </td>\n\
        <td class="finance-calc-cell ' + (unpaid > 0 ? 'negative' : 'positive') + '" id="ftUnpaid_' + plan.id + '">' + formatMoney(unpaid) + '</td>\n\
        <td class="text-center">\n\
          <span class="settle-badge ' + getSettleClass(plan.settleStatus || 'unsettled') + '" id="ftSettle_' + plan.id + '">' + settleLabel + '</span>\n\
        </td>\n\
        <td class="text-center">\n\
          <input type="text" class="finance-table-input" style="width:100px;text-align:left;" \n\
            data-id="' + plan.id + '" data-field="financeRemark" \n\
            value="' + escapeHtml(plan.financeRemark || '') + '" \n\
            maxlength="100" placeholder="备注"\n\
            onchange="financeTableCellChanged(this)" />\n\
        </td>\n\
      </tr>\n\
    ';
  });

  // 计算合计
  var totalQty = 0;
  var totalPriceSum = 0;
  var totalReceivedSum = 0;
  var totalUnpaidSum = 0;
  sorted.forEach(function (plan) {
    totalQty += Number(plan.quantity) || 0;
    totalPriceSum += Number(plan.totalPrice) || 0;
    totalReceivedSum += Number(plan.receivedAmount) || 0;
    totalUnpaidSum += Number(plan.unpaidAmount) || 0;
  });

  content.innerHTML = '\
    <!-- 弹窗头部 -->\n\
    <div class="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">\n\
      <div class="flex items-center space-x-3">\n\
        <h3 class="text-lg font-bold text-gray-800">💰 财务对账表格</h3>\n\
        <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">共 ' + sorted.length + ' 条订单</span>\n\
      </div>\n\
      <button class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1" onclick="closeFinanceTableModal()">&times;</button>\n\
    </div>\n\
    \n\
    <!-- 提示信息 -->\n\
    <div class="px-5 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">\n\
      <p class="text-xs text-blue-700">\n\
        💡 <strong>在线编辑</strong>：直接在表格中修改单价、已收金额和对账备注，总价和未收欠款会自动计算。编辑完成后点击下方「💾 保存所有修改」，然后可选择「📥 导出Excel」保存到电脑。\n\
      </p>\n\
    </div>\n\
    \n\
    <!-- 表格主体（可横向滚动） -->\n\
    <div class="finance-table-body p-3">\n\
      <table class="finance-table">\n\
        <thead>\n\
          <tr>\n\
            ' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('\n            ') + '\n\
          </tr>\n\
        </thead>\n\
        <tbody>\n\
          ' + rowsHtml + '\n\
        </tbody>\n\
        <tfoot>\n\
          <tr>\n\
            <td colspan="4" class="total-label">📊 合计</td>\n\
            <td class="total-value">-</td>\n\
            <td class="total-value" id="ftFootTotalPrice">' + formatMoney(totalPriceSum) + '</td>\n\
            <td class="total-value" id="ftFootReceived">' + formatMoney(totalReceivedSum) + '</td>\n\
            <td class="total-value" id="ftFootUnpaid" style="color:' + (totalUnpaidSum > 0 ? '#dc2626' : '#16a34a') + '">' + formatMoney(totalUnpaidSum) + '</td>\n\
            <td class="total-value">-</td>\n\
            <td class="total-value">-</td>\n\
          </tr>\n\
        </tfoot>\n\
      </table>\n\
    </div>\n\
    \n\
    <!-- 弹窗底部操作栏 -->\n\
    <div class="flex justify-between items-center p-5 border-t border-gray-100 flex-shrink-0">\n\
      <div class="finance-summary-row">\n\
        <span>📋 订单数: <strong>' + sorted.length + '</strong></span>\n\
        <span>💰 总价合计: <strong style="color:#1d4ed8;">' + formatMoney(totalPriceSum) + ' 元</strong></span>\n\
        <span>📥 已收合计: <strong style="color:#16a34a;">' + formatMoney(totalReceivedSum) + ' 元</strong></span>\n\
        <span>⚠️ 未收合计: <strong style="color:' + (totalUnpaidSum > 0 ? '#dc2626' : '#16a34a') + ';">' + formatMoney(totalUnpaidSum) + ' 元</strong></span>\n\
      </div>\n\
      <div class="flex gap-2">\n\
        <button class="btn-secondary text-sm" onclick="closeFinanceTableModal()">关闭</button>\n\
        <button class="btn-primary text-sm" id="financeSaveAllBtn" onclick="financeSaveAllChanges()">\n\
          💾 保存所有修改\n\
        </button>\n\
        <button class="btn-primary text-sm" style="background:#16a34a;" onclick="financeExportToExcel()">\n\
          📥 导出Excel\n\
        </button>\n\
      </div>\n\
    </div>\n\
  ';

  // 关闭页面滚动
  document.body.classList.add('modal-open');
  modal.classList.add('show');
  modal.onclick = function (e) {
    if (e.target === modal) closeFinanceTableModal();
  };
}

/**
 * 关闭财务对账表格弹窗
 */
function closeFinanceTableModal() {
  // 检查是否有未保存修改
  var hasChanges = false;
  var plans = getPlans();
  var keys = Object.keys(financeTableCache);
  for (var i = 0; i < keys.length; i++) {
    var plan = plans.find(function (p) { return p.id === keys[i]; });
    if (!plan) continue;
    var cache = financeTableCache[keys[i]];
    if ((plan.unitPrice || 0) !== (cache.unitPrice || 0) ||
        (plan.receivedAmount || 0) !== (cache.receivedAmount || 0) ||
        (plan.financeRemark || '') !== (cache.financeRemark || '')) {
      hasChanges = true;
      break;
    }
  }

  if (hasChanges) {
    if (!confirm('表格中有未保存的修改，确定要关闭吗？未保存的修改将丢失。')) {
      return;
    }
  }

  var modal = document.getElementById('financeTableModal');
  if (modal) modal.classList.remove('show');
  financeTableCache = {};
  document.body.classList.remove('modal-open');
}

/**
 * 财务表格单元格聚焦（记录原始值）
 */
function financeTableCellFocus(input) {
  // 聚焦时不做特殊处理，让用户直接编辑
  input.classList.remove('changed');
}

/**
 * 财务表格单元格值改变（实时计算）
 * @param {HTMLInputElement} input
 */
function financeTableCellChanged(input) {
  var planId = input.getAttribute('data-id');
  var field = input.getAttribute('data-field');

  if (!planId || !field || !financeTableCache[planId]) return;

  var plan = getPlanById(planId);
  if (!plan) return;

  // 更新缓存
  if (field === 'unitPrice' || field === 'receivedAmount') {
    financeTableCache[planId][field] = parseFloat(input.value) || 0;
  } else if (field === 'financeRemark') {
    financeTableCache[planId][field] = input.value.trim();
  }

  // 标记为已修改
  input.classList.add('changed');

  // 实时计算该行的总价和未收
  var cache = financeTableCache[planId];
  var qty = Number(plan.quantity) || 0;
  var unitPrice = cache.unitPrice || 0;
  var received = cache.receivedAmount || 0;
  var calcTotal = unitPrice * qty;
  var calcUnpaid = calcTotal - received;
  if (calcUnpaid < 0) calcUnpaid = 0;

  // 更新行内显示
  var totalCell = document.getElementById('ftTotal_' + planId);
  var unpaidCell = document.getElementById('ftUnpaid_' + planId);
  var settleBadge = document.getElementById('ftSettle_' + planId);

  if (totalCell) {
    totalCell.textContent = formatMoney(calcTotal);
    totalCell.className = 'finance-calc-cell ' + (calcTotal > 0 ? 'positive' : 'zero');
  }
  if (unpaidCell) {
    unpaidCell.textContent = formatMoney(calcUnpaid);
    unpaidCell.className = 'finance-calc-cell ' + (calcUnpaid > 0 ? 'negative' : 'positive');
  }

  // 更新结算状态徽章
  if (settleBadge) {
    var settleKey;
    if (calcTotal <= 0) {
      settleKey = 'unsettled';
    } else if (received >= calcTotal) {
      settleKey = 'settled';
    } else if (received > 0) {
      settleKey = 'partial';
    } else {
      settleKey = 'unsettled';
    }
    settleBadge.textContent = getSettleLabel(settleKey);
    settleBadge.className = 'settle-badge ' + getSettleClass(settleKey);
  }

  // 更新底部合计
  recalcFinanceFooter();
}

/**
 * 重新计算财务表格底部合计行
 */
function recalcFinanceFooter() {
  var plans = getPlans();
  var totalPriceSum = 0;
  var totalReceivedSum = 0;
  var totalUnpaidSum = 0;

  plans.forEach(function (plan) {
    var cache = financeTableCache[plan.id];
    if (cache) {
      var qty = Number(plan.quantity) || 0;
      var unitPrice = cache.unitPrice || 0;
      var received = cache.receivedAmount || 0;
      var calcTotal = unitPrice * qty;
      var calcUnpaid = calcTotal - received;
      if (calcUnpaid < 0) calcUnpaid = 0;
      totalPriceSum += calcTotal;
      totalReceivedSum += received;
      totalUnpaidSum += calcUnpaid;
    } else {
      totalPriceSum += Number(plan.totalPrice) || 0;
      totalReceivedSum += Number(plan.receivedAmount) || 0;
      totalUnpaidSum += Number(plan.unpaidAmount) || 0;
    }
  });

  var footTotal = document.getElementById('ftFootTotalPrice');
  var footReceived = document.getElementById('ftFootReceived');
  var footUnpaid = document.getElementById('ftFootUnpaid');

  if (footTotal) footTotal.textContent = formatMoney(totalPriceSum);
  if (footReceived) footReceived.textContent = formatMoney(totalReceivedSum);
  if (footUnpaid) {
    footUnpaid.textContent = formatMoney(totalUnpaidSum);
    footUnpaid.style.color = totalUnpaidSum > 0 ? '#dc2626' : '#16a34a';
  }

  // 更新底部摘要
  var summaryEls = document.querySelectorAll('.finance-summary-row strong');
  if (summaryEls.length >= 3) {
    summaryEls[1].textContent = formatMoney(totalPriceSum) + ' 元';
    summaryEls[2].textContent = formatMoney(totalReceivedSum) + ' 元';
    summaryEls[3].textContent = formatMoney(totalUnpaidSum) + ' 元';
    summaryEls[3].style.color = totalUnpaidSum > 0 ? '#dc2626' : '#16a34a';
  }
}

/**
 * 保存所有财务修改
 */
function financeSaveAllChanges() {
  var plans = getPlans();
  var savedCount = 0;

  var keys = Object.keys(financeTableCache);
  for (var i = 0; i < keys.length; i++) {
    var planId = keys[i];
    var cache = financeTableCache[planId];
    var plan = plans.find(function (p) { return p.id === planId; });
    if (!plan) continue;

    // 检查是否有变化
    if ((plan.unitPrice || 0) === (cache.unitPrice || 0) &&
        (plan.receivedAmount || 0) === (cache.receivedAmount || 0) &&
        (plan.financeRemark || '') === (cache.financeRemark || '')) {
      continue;
    }

    // 保存财务数据
    updatePlanFinance(planId, {
      unitPrice: cache.unitPrice,
      receivedAmount: cache.receivedAmount,
      financeRemark: cache.financeRemark
    });
    savedCount++;
  }

  if (savedCount > 0) {
    showToast('财务数据保存成功！共更新 ' + savedCount + ' 条记录', 'success');
    // 更新缓存以匹配已保存数据
    var updatedPlans = getPlans();
    financeTableCache = {};
    updatedPlans.forEach(function (p) {
      financeTableCache[p.id] = {
        unitPrice: p.unitPrice || 0,
        receivedAmount: p.receivedAmount || 0,
        financeRemark: p.financeRemark || ''
      };
    });
    // 清除所有 changed 标记
    var inputs = document.querySelectorAll('.finance-table-input.changed');
    inputs.forEach(function (inp) { inp.classList.remove('changed'); });
    // 刷新列表
    refreshList();
  } else {
    showToast('没有需要保存的修改', 'info');
  }
}

/**
 * 从财务表格导出 Excel 文件
 */
function financeExportToExcel() {
  // 先检查是否有未保存的修改
  var hasChanges = false;
  var plans = getPlans();
  var keys = Object.keys(financeTableCache);
  for (var i = 0; i < keys.length; i++) {
    var plan = plans.find(function (p) { return p.id === keys[i]; });
    if (!plan) continue;
    var cache = financeTableCache[keys[i]];
    if ((plan.unitPrice || 0) !== (cache.unitPrice || 0) ||
        (plan.receivedAmount || 0) !== (cache.receivedAmount || 0) ||
        (plan.financeRemark || '') !== (cache.financeRemark || '')) {
      hasChanges = true;
      break;
    }
  }

  if (hasChanges) {
    if (!confirm('表格中有未保存的修改。\n\n点击「确定」：先保存修改再导出\n点击「取消」：仅导出已保存的数据')) {
      // 用户选择不保存，使用已存储数据导出
      doFinanceExport(plans);
      return;
    }
    // 先保存
    financeSaveAllChanges();
    plans = getPlans(); // 重新获取最新数据
  }

  doFinanceExport(plans);
}

/**
 * 执行财务 Excel 导出
 */
function doFinanceExport(plans) {
  if (plans.length === 0) {
    showToast('暂无数据可导出', 'warning');
    return;
  }

  var BOM = '\uFEFF';
  var headers = [
    '计划编号', '钢材类型', '规格', '数量', '单位',
    '钢材单价(元)', '总价(元)', '已收金额(元)', '未收欠款(元)',
    '结算状态', '对账备注', '当前工序', '进度状态',
    '客户', '交货日期', '创建时间'
  ];

  var processStepMap = {};
  PROCESS_STEPS.forEach(function (s) { processStepMap[s.key] = s.label; });

  var rows = [headers.join(',')];

  plans.forEach(function (plan) {
    // 如果有缓存则使用缓存值
    var cache = financeTableCache[plan.id];
    var unitPrice = cache ? (cache.unitPrice || 0) : (plan.unitPrice || 0);
    var totalPrice, received, unpaid, settleStatus;
    if (cache) {
      var qty = Number(plan.quantity) || 0;
      totalPrice = unitPrice * qty;
      received = cache.receivedAmount || 0;
      unpaid = totalPrice - received;
      if (unpaid < 0) unpaid = 0;
      if (totalPrice <= 0) settleStatus = 'unsettled';
      else if (received >= totalPrice) settleStatus = 'settled';
      else if (received > 0) settleStatus = 'partial';
      else settleStatus = 'unsettled';
    } else {
      totalPrice = plan.totalPrice || 0;
      received = plan.receivedAmount || 0;
      unpaid = plan.unpaidAmount || 0;
      settleStatus = plan.settleStatus || 'unsettled';
    }

    var row = [
      csvEscape(plan.planNo),
      csvEscape(plan.steelType),
      csvEscape(plan.specification),
      plan.quantity,
      csvEscape(plan.unit),
      Number(unitPrice).toFixed(2),
      Number(totalPrice).toFixed(2),
      Number(received).toFixed(2),
      Number(unpaid).toFixed(2),
      csvEscape(getSettleLabel(settleStatus)),
      csvEscape(cache ? (cache.financeRemark || '') : (plan.financeRemark || '-')),
      csvEscape(processStepMap[plan.processStep] || '-'),
      csvEscape((PROGRESS_STATUS[plan.progressStatus] || PROGRESS_STATUS.pending).label),
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
    a.download = 'steel_finance_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('财务账单导出成功！共 ' + plans.length + ' 条记录', 'success');
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error');
  }
}

// ==========================================
// 多次回款管理（三级详情弹窗）
// ==========================================

/**
 * 构建回款记录列表 HTML
 */
function buildPaymentRecordsHtml(plan) {
  var records = plan.paymentRecords || [];
  if (records.length === 0) {
    return '<div class="text-xs text-gray-400 text-center py-2">暂无回款记录</div>';
  }
  var html = '';
  records.slice().reverse().forEach(function (r) {
    var dateStr = r.date || '-';
    html += '\
      <div class="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-gray-100">\n\
        <div class="flex items-center gap-1.5 flex-1 min-w-0">\n\
          <span class="text-green-600 font-bold flex-shrink-0">¥' + formatMoney(r.amount || 0) + '</span>\n\
          <span class="text-gray-400">' + (r.method || '-') + '</span>\n\
          <span class="text-gray-300 flex-shrink-0">' + dateStr + '</span>\n\
          ' + (r.remark ? '<span class="text-gray-400 truncate">' + escapeHtml(r.remark) + '</span>' : '') + '\n\
        </div>\n\
        <button class="text-red-400 hover:text-red-600 text-xs ml-1 flex-shrink-0" onclick="detailDeletePayment(event, \'' + r.id + '\')" title="删除此回款">✕</button>\n\
      </div>\n\
    ';
  });
  return html;
}

/**
 * 添加一笔回款
 */
function detailAddPayment() {
  if (!detailPlanId || isDetailSaving) return;
  var amountEl = document.getElementById('detailNewPmtAmount');
  var dateEl = document.getElementById('detailNewPmtDate');
  var methodEl = document.getElementById('detailNewPmtMethod');

  var amount = parseFloat(amountEl ? amountEl.value : 0);
  if (isNaN(amount) || amount <= 0) {
    showToast('请输入有效的回款金额', 'warning');
    return;
  }

  var result = addPaymentRecord(detailPlanId, {
    amount: amount,
    date: dateEl ? dateEl.value : getTodayStr(),
    method: methodEl ? methodEl.value : '银行转账',
    remark: ''
  });

  if (result) {
    showToast('回款 ¥' + formatMoney(amount) + ' 录入成功！', 'success');
    // 清空输入
    if (amountEl) amountEl.value = '';
    // 刷新详情弹窗
    refreshList();
    openDetailModal(detailPlanId);
  } else {
    showToast('回款录入失败', 'error');
  }
}

/**
 * 删除一笔回款
 */
function detailDeletePayment(event, paymentId) {
  event.stopPropagation();
  if (!detailPlanId || isDetailSaving) return;
  if (!confirm('确定要删除这笔回款记录吗？')) return;

  var result = deletePaymentRecord(detailPlanId, paymentId);
  if (result) {
    showToast('回款记录已删除', 'info');
    refreshList();
    openDetailModal(detailPlanId);
  } else {
    showToast('删除失败', 'error');
  }
}

/**
 * 更新详情弹窗中自动计算（改为从回款记录汇总）
 */
function detailAutoCalcTotal() {
  var unitPriceEl = document.getElementById('detailUnitPrice');
  var totalEl = document.getElementById('detailTotalPrice');
  var unpaidBox = document.getElementById('detailUnpaidBox');
  var unpaidEl = document.getElementById('detailUnpaidAmount');

  if (!detailPlanId) return;
  var plan = getPlanById(detailPlanId);
  if (!plan) return;

  var unitPrice = unitPriceEl ? parseFloat(unitPriceEl.value) || 0 : 0;
  var quantity = Number(plan.quantity) || 0;
  var totalPrice = unitPrice * quantity;

  // 已收从回款记录汇总
  var records = plan.paymentRecords || [];
  var totalReceived = 0;
  records.forEach(function (r) { totalReceived += Number(r.amount) || 0; });

  var unpaid = totalPrice - totalReceived;
  if (unpaid < 0) unpaid = 0;

  if (totalEl) totalEl.textContent = formatMoney(totalPrice) + ' 元';
  if (unpaidEl) unpaidEl.textContent = formatMoney(unpaid) + ' 元';

  // 欠款区域颜色变化
  if (unpaidBox) {
    if (unpaid <= 0 && totalPrice > 0) {
      unpaidBox.style.background = '#f0fdf4';
      if (unpaidEl) unpaidEl.style.color = '#16a34a';
    } else if (unpaid > 0) {
      unpaidBox.style.background = '#fef2f2';
      if (unpaidEl) unpaidEl.style.color = '#dc2626';
    } else {
      unpaidBox.style.background = '#f3f4f6';
      if (unpaidEl) unpaidEl.style.color = '#9ca3af';
    }
  }

  // 更新已收总额显示
  var receivedTotalEl = document.getElementById('detailReceivedTotal');
  if (receivedTotalEl) {
    receivedTotalEl.textContent = formatMoney(totalReceived);
  }
}

/**
 * 详情弹窗中保存财务数据（适配多次回款）
 */
function detailSaveFinance() {
  if (!detailPlanId || isDetailSaving) return;
  isDetailSaving = true;

  try {
    var unitPriceEl = document.getElementById('detailUnitPrice');
    var remarkEl = document.getElementById('detailFinanceRemark');

    var unitPrice = unitPriceEl ? parseFloat(unitPriceEl.value) || 0 : 0;
    var remark = remarkEl ? remarkEl.value.trim() : '';

    // 获取回款记录汇总
    var plan = getPlanById(detailPlanId);
    var records = plan ? (plan.paymentRecords || []) : [];
    var totalReceived = 0;
    records.forEach(function (r) { totalReceived += Number(r.amount) || 0; });

    var result = updatePlanFinance(detailPlanId, {
      unitPrice: unitPrice,
      receivedAmount: totalReceived,
      financeRemark: remark
    });

    if (!result) {
      showToast('保存失败', 'error');
      isDetailSaving = false;
      return;
    }

    showToast('财务数据保存成功！', 'success');
    refreshList();
    openDetailModal(detailPlanId);
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }

  isDetailSaving = false;
}

// ==========================================
// 历史存档查询
// ==========================================

/**
 * 打开历史数据查询弹窗
 */
function openHistoryModal() {
  // 移除旧弹窗
  var oldModal = document.getElementById('historyModal');
  if (oldModal) oldModal.remove();

  var dates = getArchiveDates();

  var modal = document.createElement('div');
  modal.id = 'historyModal';
  modal.className = 'fixed inset-0 z-[90] hidden items-center justify-center bg-black/40';
  modal.innerHTML = '\
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">\n\
      <div class="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">\n\
        <div class="flex items-center space-x-3">\n\
          <h3 class="text-lg font-bold text-gray-800">📅 历史数据查询</h3>\n\
          <span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">共 ' + dates.length + ' 天存档</span>\n\
        </div>\n\
        <button class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1" onclick="closeHistoryModal()">&times;</button>\n\
      </div>\n\
      <div class="p-4 border-b border-gray-100 flex-shrink-0">\n\
        <div class="flex gap-2 items-center flex-wrap">\n\
          <label class="text-sm font-bold text-gray-600 flex-shrink-0">选择日期：</label>\n\
          <select id="historyDateSelect" class="form-select flex-1 min-w-[200px]" onchange="loadHistoryData()">\n\
            <option value="">-- 请选择存档日期 --</option>\n\
            ' + dates.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('\n            ') + '\n\
          </select>\n\
          <button class="btn-secondary text-sm flex-shrink-0" onclick="closeHistoryModal()">关闭</button>\n\
        </div>\n\
      </div>\n\
      <div class="p-4 overflow-y-auto flex-1" id="historyDataContent">\n\
        <p class="text-gray-400 text-center py-8">请选择存档日期查看历史数据</p>\n\
      </div>\n\
    </div>\n\
  ';

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  modal.classList.add('show');
  modal.onclick = function (e) {
    if (e.target === modal) closeHistoryModal();
  };
}

/**
 * 加载指定日期的历史数据
 */
function loadHistoryData() {
  var select = document.getElementById('historyDateSelect');
  var content = document.getElementById('historyDataContent');
  if (!select || !content) return;

  var dateStr = select.value;
  if (!dateStr) {
    content.innerHTML = '<p class="text-gray-400 text-center py-8">请选择存档日期查看历史数据</p>';
    return;
  }

  var archive = getArchiveByDate(dateStr);
  if (!archive || !archive.data || archive.data.length === 0) {
    content.innerHTML = '<p class="text-gray-400 text-center py-8">该日期暂无存档数据</p>';
    return;
  }

  var plans = archive.data;
  var html = '\
    <div class="mb-3 flex items-center justify-between">\n\
      <div>\n\
        <span class="text-sm text-gray-500">📅 存档日期：<b>' + dateStr + '</b></span>\n\
        <span class="text-sm text-gray-500 ml-3">📋 共 <b>' + plans.length + '</b> 条记录</span>\n\
        <span class="text-sm text-gray-500 ml-3">🕐 存档时间：<b>' + (archive.timestamp || '-').slice(0, 19).replace('T', ' ') + '</b></span>\n\
      </div>\n\
    </div>\n\
    <div class="table-wrapper">\n\
      <table class="w-full text-sm">\n\
        <thead>\n\
          <tr class="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">\n\
            <th class="px-3 py-2 text-left">计划编号</th>\n\
            <th class="px-3 py-2 text-left">钢材类型</th>\n\
            <th class="px-3 py-2 text-left">规格</th>\n\
            <th class="px-3 py-2 text-right">数量</th>\n\
            <th class="px-3 py-2 text-center">工序</th>\n\
            <th class="px-3 py-2 text-center">进度</th>\n\
            <th class="px-3 py-2 text-left">交货日期</th>\n\
            <th class="px-3 py-2 text-center">状态</th>\n\
            <th class="px-3 py-2 text-left">客户</th>\n\
          </tr>\n\
        </thead>\n\
        <tbody class="divide-y divide-gray-100">\n\
  ';

  plans.forEach(function (plan) {
    var progressLabel = getProgressLabel(plan.progressStatus);
    var progressClass = getProgressClass(plan.progressStatus);
    var stepLabel = getStepLabel(plan.processStep);
    var statusLabels = { pending: '待生产', processing: '生产中', completed: '已完成', cancelled: '已取消' };
    var statusClasses = { pending: 'status-pending', processing: 'status-processing', completed: 'status-completed', cancelled: 'status-cancelled' };

    html += '\
          <tr class="hover:bg-gray-50">\n\
            <td class="px-3 py-2 font-medium text-gray-800">' + escapeHtml(plan.planNo) + '</td>\n\
            <td class="px-3 py-2 text-gray-600">' + escapeHtml(plan.steelType) + '</td>\n\
            <td class="px-3 py-2 text-gray-600">' + escapeHtml(plan.specification) + '</td>\n\
            <td class="px-3 py-2 text-right text-gray-800">' + plan.quantity + ' ' + escapeHtml(plan.unit) + '</td>\n\
            <td class="px-3 py-2 text-center text-gray-600 text-xs">' + escapeHtml(stepLabel) + '</td>\n\
            <td class="px-3 py-2 text-center"><span class="progress-badge ' + progressClass + '">' + progressLabel + '</span></td>\n\
            <td class="px-3 py-2 text-gray-600">' + formatDate(plan.deliveryDate) + '</td>\n\
            <td class="px-3 py-2 text-center"><span class="status-badge ' + (statusClasses[plan.status] || '') + '">' + (statusLabels[plan.status] || plan.status) + '</span></td>\n\
            <td class="px-3 py-2 text-gray-600">' + (plan.customer ? escapeHtml(plan.customer) : '<span class="text-gray-300">-</span>') + '</td>\n\
          </tr>\n\
    ';
  });

  html += '\
        </tbody>\n\
      </table>\n\
    </div>\n\
  ';

  content.innerHTML = html;
}

/**
 * 关闭历史查询弹窗
 */
function closeHistoryModal() {
  var modal = document.getElementById('historyModal');
  if (modal) {
    modal.classList.remove('show');
    modal.remove();
  }
  document.body.classList.remove('modal-open');
}

/**
 * 更新详情弹窗中的工序进度条
 * @param {string} currentStep - 当前工序 key
 */
function updateDetailProgressBar(currentStep) {
  try {
    var totalSteps = PROCESS_STEPS ? PROCESS_STEPS.length : 7;
    var stepIdx = PROCESS_STEPS ? PROCESS_STEPS.findIndex(function (s) { return s.key === currentStep; }) : -1;
    if (stepIdx < 0) { stepIdx = 0; }
    // 进度 = (当前步骤索引+1) / 总步骤数 * 100
    var percent = Math.min(100, Math.max(0, Math.round((stepIdx + 1) / totalSteps * 100)));
    var percentEl = document.getElementById('detailProgressPercent');
    var fillEl = document.getElementById('detailProgressFill');
    if (percentEl) percentEl.textContent = percent + '%';
    if (fillEl) fillEl.style.width = percent + '%';
  } catch (e) { /* ignore progress bar errors */ }
}


// ==========================================
// 首页预警面板（每次渲染列表时调用）
// ==========================================

/**
 * 渲染预警面板（订单即将到期/已延期提醒）
 */
function renderAlertPanel(plans) {
  var container = document.getElementById('listContainer');
  if (!container) return;

  var alerts = getAlertOrders();

  if (alerts.length === 0) return;

  var panelHtml = '\
    <div class="bg-white rounded-xl shadow-sm border border-red-200 mb-4 overflow-hidden" id="alertPanel">\n\
      <div class="flex items-center justify-between p-3 cursor-pointer select-none" onclick="toggleAlertPanel()" style="background:linear-gradient(135deg,#fef2f2,#fff7ed);">\n\
        <div class="flex items-center gap-2">\n\
          <span class="text-lg">⚠️</span>\n\
          <span class="font-bold text-red-600 text-sm">订单预警</span>\n\
          <span class="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">' + alerts.length + ' 条</span>\n\
        </div>\n\
        <span class="text-gray-400 text-xs" id="alertToggleIcon">' + (isAlertPanelExpanded ? '▲ 收起' : '▼ 展开') + '</span>\n\
      </div>\n\
      <div class="' + (isAlertPanelExpanded ? '' : 'hidden') + '" id="alertPanelBody">\n\
        <div class="px-3 pb-3 space-y-2">\n\
  ';

  alerts.forEach(function (alert) {
    var plan = alert.plan;
    var level = alert.level;
    var daysLabel = '';
    if (alert.daysLeft < 0) {
      daysLabel = '超期 <b>' + Math.abs(alert.daysLeft) + '</b> 天';
    } else if (alert.daysLeft === 0) {
      daysLabel = '今天到期！';
    } else {
      daysLabel = '还剩 <b>' + alert.daysLeft + '</b> 天';
    }

    panelHtml += '\
          <div class="flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" style="background:' + level.bg + ';border-left:3px solid ' + level.color + ';" onclick="openDetailModal(\'' + plan.id + '\')" title="点击查看详情">\n\
            <div class="flex items-center gap-2 flex-1 min-w-0">\n\
              <span>' + level.icon + '</span>\n\
              <span class="font-semibold text-sm truncate" style="color:' + level.color + ';">' + escapeHtml(plan.planNo) + '</span>\n\
              <span class="text-xs text-gray-500 truncate hidden sm:inline">' + escapeHtml(plan.steelType) + ' | ' + escapeHtml(plan.customer || '-') + '</span>\n\
            </div>\n\
            <div class="flex items-center gap-2 flex-shrink-0">\n\
              <span class="text-xs font-bold" style="color:' + level.color + ';">' + daysLabel + '</span>\n\
              <span class="text-xs text-gray-400">📅 ' + formatDate(plan.deliveryDate) + '</span>\n\
            </div>\n\
          </div>\n\
    ';
  });

  panelHtml += '\
        </div>\n\
      </div>\n\
    </div>\n\
  ';

  var filterBar = container.querySelector('.bg-white.rounded-xl.shadow-sm.border.border-gray-200.p-4');
  if (filterBar) {
    var oldAlert = document.getElementById('alertPanel');
    if (oldAlert) oldAlert.remove();
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = panelHtml;
    var alertNode = tempDiv.firstElementChild;
    filterBar.parentNode.insertBefore(alertNode, filterBar.nextSibling);
  }
}

/**
 * 切换预警面板展开/收起
 */
function toggleAlertPanel() {
  isAlertPanelExpanded = !isAlertPanelExpanded;
  var body = document.getElementById('alertPanelBody');
  var icon = document.getElementById('alertToggleIcon');
  if (body) {
    if (isAlertPanelExpanded) { body.classList.remove('hidden'); }
    else { body.classList.add('hidden'); }
  }
  if (icon) {
    icon.textContent = isAlertPanelExpanded ? '▲ 收起' : '▼ 展开';
  }
}


/* ===== customer-service.js ===== */
/* ==========================================
   Steel 钢材管理系统 - 悬浮智能客服AI问答系统
   v2.0 - 预警自动广播、隐私查询验证、客户名/钢号/订单号查询
   拖拽逻辑：必须按住鼠标左键拖拽才能移动按钮位置，松开即停止
   点击逻辑：单击（不拖拽）才打开/关闭客服窗口
   ========================================== */

/**
 * 智能客服状态
 */
var csOpen = false;
var csIsMinimized = false;
// 拖拽状态
var csPointerDown = false;
var csIsDragging = false;
var csPointerStartX = 0;
var csPointerStartY = 0;
var csStartLeft = 0;
var csStartTop = 0;
var csDragMoved = false;
// 拖拽阈值（像素）：移动超过此值才算拖拽
var CS_DRAG_THRESHOLD = 5;
// 隐私验证状态
var csVerifiedCustomer = null;
var csPendingQuery = null;
// 预警角标定时器
var csAlertBadgeTimer = null;

/**
 * 初始化智能客服（在 DOMContentLoaded 时调用）
 */
function initCustomerService() {
  // 创建悬浮按钮（含预警角标容器）
  var floatBtn = document.createElement('div');
  floatBtn.id = 'csFloatBtn';
  floatBtn.innerHTML = '<span style="position:relative;display:inline-flex;">' +
    '<span style="font-size:1.5rem;">🤖</span>' +
    '<span id="csAlertBadge" style="display:none;position:absolute;top:-6px;right:-8px;background:#dc2626;color:#fff;font-size:0.65rem;font-weight:700;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;padding:0 4px;border:2px solid #fff;"></span>' +
    '</span><span class="cs-float-text">智能客服</span>';
  floatBtn.className = 'cs-float-btn';
  floatBtn.title = '智能客服 — 按住拖拽移动位置 | 点击查询订单进度、财务结算';
  floatBtn.setAttribute('data-cs-draggable', 'true');
  document.body.appendChild(floatBtn);

  // 创建客服窗口
  var chatWindow = document.createElement('div');
  chatWindow.id = 'csChatWindow';
  chatWindow.className = 'cs-chat-window';
  chatWindow.innerHTML = buildCSWindowHTML();
  document.body.appendChild(chatWindow);

  // 绑定拖拽事件（使用 pointer 事件，同时支持鼠标和触摸）
  bindCSDragEvents(floatBtn);

  // 点击处理：仅当没有拖拽行为时才触发
  floatBtn.addEventListener('click', function (e) {
    // 如果这个 click 是由拖拽引起的，忽略
    if (csDragMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (csIsMinimized) {
      restoreCustomerService();
    } else if (!csOpen) {
      openCustomerService();
    } else {
      closeCustomerService();
    }
  });

  // 启动预警角标更新
  updateCSAlertBadge();
  csAlertBadgeTimer = setInterval(updateCSAlertBadge, 30000); // 每30秒刷新
}

/**
 * 构建客服窗口 HTML
 */
function buildCSWindowHTML() {
  return '\
    <div class="cs-chat-header" id="csChatHeader">\
      <div class="cs-chat-header-left">\
        <span class="cs-chat-avatar">🤖</span>\
        <div>\
          <div class="cs-chat-title">智能客服助手</div>\
          <div class="cs-chat-subtitle">离线查询 · 实时同步</div>\
        </div>\
      </div>\
      <div class="cs-chat-header-right">\
        <button class="cs-header-btn" onclick="minimizeCustomerService()" title="最小化">─</button>\
        <button class="cs-header-btn" onclick="closeCustomerService()" title="关闭">✕</button>\
      </div>\
    </div>\
    \
    <div class="cs-chat-body" id="csChatBody">\
      <div class="cs-message cs-message-bot">\
        <div class="cs-message-avatar">🤖</div>\
        <div class="cs-message-bubble">\
          您好！我是钢材管理智能客服助手 🤖<br>\
          可以帮您查询订单的生产进度和财务结算情况。<br><br>\
          <b>您可以输入：</b><br>\
          🔍 客户名称（如：张三公司）<br>\
          🔍 钢号/钢材类型（如：热轧卷板）<br>\
          🔍 计划编号（如：PL-20260529-001）<br>\
          🔍 直接输入「<b>全部订单</b>」查看所有订单<br>\
          🔍 输入「<b>待结算</b>」查看未结清订单\
        </div>\
      </div>\
    </div>\
    \
    <div class="cs-chat-input-area">\
      <input type="text" class="cs-chat-input" id="csChatInput" \
        placeholder="输入客户名/钢号/订单号..." \
        onkeydown="if(event.key===\'Enter\')csSendMessage()" />\
      <button class="cs-send-btn" onclick="csSendMessage()">发送</button>\
    </div>\
  ';
}

/**
 * 绑定拖拽事件（使用 pointer 事件统一处理鼠标和触摸）
 * 逻辑：必须按住左键/手指按住才能拖拽移动，松开即停止，单击才打开窗口
 */
function bindCSDragEvents(floatBtn) {
  // 按下：记录起始位置，进入"可能拖拽"状态
  floatBtn.addEventListener('pointerdown', function (e) {
    // 只响应左键或触摸
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    csPointerDown = true;
    csIsDragging = false;
    csDragMoved = false;
    csPointerStartX = e.clientX;
    csPointerStartY = e.clientY;

    // 读取当前按钮实际位置（支持 left/top 或 right/bottom 定位）
    var style = getComputedStyle(floatBtn);
    if (style.right !== 'auto' && style.right !== '') {
      // 使用 right/bottom 定位 → 转为 left/top
      csStartLeft = window.innerWidth - floatBtn.offsetWidth - parseFloat(style.right);
      csStartTop = window.innerHeight - floatBtn.offsetHeight - parseFloat(style.bottom);
      floatBtn.style.right = 'auto';
      floatBtn.style.bottom = 'auto';
      floatBtn.style.left = csStartLeft + 'px';
      floatBtn.style.top = csStartTop + 'px';
    } else {
      csStartLeft = parseFloat(style.left) || 0;
      csStartTop = parseFloat(style.top) || 0;
    }

    // 捕获指针，确保在元素外也能追踪
    floatBtn.setPointerCapture(e.pointerId);
  });

  // 移动：移动超过阈值则进入拖拽模式
  floatBtn.addEventListener('pointermove', function (e) {
    if (!csPointerDown) return;
    e.preventDefault();

    var dx = e.clientX - csPointerStartX;
    var dy = e.clientY - csPointerStartY;

    // 超过阈值才标记为拖拽（避免点击时微小抖动触发拖拽）
    if (!csIsDragging && (Math.abs(dx) > CS_DRAG_THRESHOLD || Math.abs(dy) > CS_DRAG_THRESHOLD)) {
      csIsDragging = true;
      csDragMoved = true;
      floatBtn.classList.add('cs-dragging');
    }

    if (csIsDragging) {
      var newLeft = csStartLeft + dx;
      var newTop = csStartTop + dy;
      // 边界限制（保留按钮可见区域）
      var btnW = floatBtn.offsetWidth;
      var btnH = floatBtn.offsetHeight;
      var maxLeft = window.innerWidth - btnW;
      var maxTop = window.innerHeight - btnH;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      floatBtn.style.left = newLeft + 'px';
      floatBtn.style.top = newTop + 'px';
    }
  });

  // 松开：结束拖拽，重置状态（csDragMoved 延迟重置，确保 click 事件能读取到正确值）
  floatBtn.addEventListener('pointerup', function (e) {
    floatBtn.classList.remove('cs-dragging');
    csPointerDown = false;
    csIsDragging = false;
    // 释放指针捕获
    try { floatBtn.releasePointerCapture(e.pointerId); } catch (ex) { /* ignore */ }
    // 延迟重置 csDragMoved，因为 click 事件在 pointerup 之后才触发
    setTimeout(function () { csDragMoved = false; }, 0);
  });

  floatBtn.addEventListener('pointercancel', function (e) {
    floatBtn.classList.remove('cs-dragging');
    csPointerDown = false;
    csIsDragging = false;
    csDragMoved = false;
    try { floatBtn.releasePointerCapture(e.pointerId); } catch (ex) { /* ignore */ }
  });

  // 防止拖拽时选中文本
  floatBtn.addEventListener('selectstart', function (e) {
    if (csPointerDown) e.preventDefault();
  });
}

/**
 * 打开客服窗口
 */
function openCustomerService() {
  var win = document.getElementById('csChatWindow');
  var btn = document.getElementById('csFloatBtn');
  if (!win) return;
  csOpen = true;
  csIsMinimized = false;
  csVerifiedCustomer = null;
  csPendingQuery = null;
  win.classList.add('cs-open');
  if (btn) btn.style.opacity = '0.6';

  // 自动广播预警信息
  setTimeout(function () {
    csBroadcastAlerts();
  }, 500);

  // 聚焦输入框
  setTimeout(function () {
    var input = document.getElementById('csChatInput');
    if (input) input.focus();
  }, 300);
}

/**
 * 更新客服悬浮按钮上的预警角标
 */
function updateCSAlertBadge() {
  var badge = document.getElementById('csAlertBadge');
  if (!badge) return;
  try {
    var alerts = getAlertOrders ? getAlertOrders() : [];
    var count = alerts.length;
    if (count > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    badge.style.display = 'none';
  }
}

/**
 * 自动广播预警订单
 */
function csBroadcastAlerts() {
  try {
    var alerts = getAlertOrders ? getAlertOrders() : [];
    if (alerts.length === 0) {
      csAppendMessage('bot', '✅ 当前没有需要预警的订单，一切正常！<br><br>您可以输入客户名、钢号或订单号进行查询。');
      return;
    }

    var overdueCount = alerts.filter(function (a) { return a.level.priority === 0; }).length;
    var todayCount = alerts.filter(function (a) { return a.level.priority === 1; }).length;
    var soonCount = alerts.filter(function (a) { return a.level.priority === 2; }).length;

    var broadcast = '⚠️ <b>订单预警播报</b><br><br>';
    if (overdueCount > 0) {
      broadcast += '🔴 <b>已延期：' + overdueCount + ' 条</b> — 请尽快处理！<br>';
    }
    if (todayCount > 0) {
      broadcast += '🟡 <b>今日到期：' + todayCount + ' 条</b> — 请关注交付！<br>';
    }
    if (soonCount > 0) {
      broadcast += '🟠 <b>即将到期（3天内）：' + soonCount + ' 条</b><br>';
    }
    broadcast += '<br>';

    // 显示前5条最紧急的预警
    var top5 = alerts.slice(0, 5);
    top5.forEach(function (a) {
      var plan = a.plan;
      var daysLabel = a.daysLeft < 0 ? '超期 <b>' + Math.abs(a.daysLeft) + '</b> 天' :
        (a.daysLeft === 0 ? '<b>今天到期！</b>' : '还剩 <b>' + a.daysLeft + '</b> 天');
      broadcast += '<div class="cs-order-card" style="border-left:3px solid ' + a.level.color + ';">' +
        '<div class="cs-order-header">' +
        '<span class="cs-order-no">' + a.level.icon + ' ' + escapeHtml(plan.planNo) + '</span>' +
        '<span style="color:' + a.level.color + ';font-size:0.7rem;font-weight:700;">' + daysLabel + '</span>' +
        '</div>' +
        '<div class="cs-order-body">' +
        '📦 ' + escapeHtml(plan.steelType) + ' | ' + escapeHtml(plan.specification) +
        ' | 📅 ' + (plan.deliveryDate ? formatDate(plan.deliveryDate) : '-') +
        (plan.customer ? ' | 🏢 ' + escapeHtml(plan.customer) : '') +
        '</div></div>';
    });

    if (alerts.length > 5) {
      broadcast += '<br>📌 ...还有 <b>' + (alerts.length - 5) + '</b> 条预警，请输入「<b>延期</b>」查看全部。';
    }

    broadcast += '<br><br>💡 您可以输入客户名、钢号或订单号进行精准查询。';

    csAppendMessage('bot', broadcast);
  } catch (e) {
    csAppendMessage('bot', '系统正在初始化中，请稍后再试。');
  }
}

/**
 * 关闭客服窗口
 */
function closeCustomerService() {
  var win = document.getElementById('csChatWindow');
  var btn = document.getElementById('csFloatBtn');
  if (!win) return;
  csOpen = false;
  csIsMinimized = false;
  csVerifiedCustomer = null;
  csPendingQuery = null;
  win.classList.remove('cs-open', 'cs-minimized');
  if (btn) btn.style.opacity = '1';
}

/**
 * 最小化客服窗口
 */
function minimizeCustomerService() {
  var win = document.getElementById('csChatWindow');
  if (!win) return;
  csIsMinimized = true;
  win.classList.add('cs-minimized');
  win.classList.remove('cs-open');
}

/**
 * 恢复客服窗口
 */
function restoreCustomerService() {
  var win = document.getElementById('csChatWindow');
  if (!win) return;
  csIsMinimized = false;
  win.classList.remove('cs-minimized');
  win.classList.add('cs-open');
}

/**
 * 发送消息
 */
function csSendMessage() {
  var input = document.getElementById('csChatInput');
  if (!input) return;
  var query = input.value.trim();
  if (!query) return;
  input.value = '';

  // 显示用户消息
  csAppendMessage('user', query);

  // 处理查询
  var result = csProcessQuery(query);

  // 模拟延迟回复
  setTimeout(function () {
    csAppendMessage('bot', result);
  }, 400 + Math.random() * 300);
}

/**
 * 处理查询
 */
function csProcessQuery(query) {
  try {
    var plans = getPlans();
    if (plans.length === 0) {
      return '📋 当前系统中暂无生产计划数据。<br>请先在「生产计划录入」页面添加订单。';
    }

    var q = query.toLowerCase().trim();

    // 隐私验证响应处理
    if (q === '是' || q === 'yes' || q === '确认' || q === '确定') {
      if (csPendingQuery) {
        csVerifiedCustomer = csPendingQuery;
        var verifiedPlans = plans.filter(function (plan) {
          return plan.customer && plan.customer.toLowerCase().indexOf(csPendingQuery.toLowerCase()) !== -1;
        });
        csPendingQuery = null;
        if (verifiedPlans.length === 0) {
          return '该客户名下暂无订单记录。';
        }
        return csShowMatchedOrders(verifiedPlans, csVerifiedCustomer);
      }
      return '✅ 收到确认。请问您需要什么帮助？';
    }
    if (q === '否' || q === 'no' || q === '取消') {
      csPendingQuery = null;
      csVerifiedCustomer = null;
      return '已取消查询。请输入其他查询关键词，或输入「<b>帮助</b>」查看使用说明。';
    }

    // 快捷指令
    if (q === '全部订单' || q === 'all' || q === '全部') {
      return csShowAllOrders(plans);
    }
    if (q === '待结算' || q === '未结清' || q === '欠款') {
      return csShowUnsettled(plans);
    }
    if (q === '已完成' || q === '已完工') {
      return csShowCompleted(plans);
    }
    if (q === '延期' || q === '超期') {
      return csShowDelayed(plans);
    }
    if (q === '预警' || q === '报警') {
      csBroadcastAlerts();
      return ''; // 已通过 csAppendMessage 直接发送
    }
    if (q === '帮助' || q === 'help' || q === '?' || q === '？') {
      return csShowHelp();
    }

    // 关键词搜索
    var matched = [];
    var lowerQ = q;
    plans.forEach(function (plan) {
      var searchStr = (plan.planNo + '|' + plan.steelType + '|' + plan.specification + '|' + plan.customer + '|' + plan.remark).toLowerCase();
      if (searchStr.indexOf(lowerQ) !== -1) {
        matched.push(plan);
      }
    });

    if (matched.length === 0) {
      return '🔍 未找到与「<b>' + escapeHtml(query) + '</b>」匹配的订单。<br><br>'
        + '💡 <b>提示：</b><br>'
        + '• 请检查客户名/钢号/订单号是否正确<br>'
        + '• 可以输入「<b>全部订单</b>」查看所有记录<br>'
        + '• 输入「<b>帮助</b>」查看使用说明';
    }

    // 隐私验证：查询客户名时需确认身份
    if (matched.length > 0) {
      var isCustomerQuery = csIsCustomerNameQuery(query, plans);
      if (isCustomerQuery && !csVerifiedCustomer) {
        // 需要验证
        csPendingQuery = query;
        var uniqueCustomers = [];
        matched.forEach(function (p) {
          if (p.customer && uniqueCustomers.indexOf(p.customer.toLowerCase()) === -1) {
            uniqueCustomers.push(p.customer.toLowerCase());
          }
        });
        return '🔒 <b>隐私验证</b><br><br>'
          + '您正在查询客户「<b>' + escapeHtml(query) + '</b>」的订单信息。<br>'
          + '共匹配到 <b>' + matched.length + '</b> 条记录。<br><br>'
          + '请确认您有权查看该客户的订单数据：<br>'
          + '• 回复「<b>是</b>」确认查询<br>'
          + '• 回复「<b>否</b>」取消查询<br><br>'
          + '<span style="color:#9ca3af;font-size:0.75rem;">此验证仅在本会话有效，关闭窗口后需重新验证。</span>';
      }
    }

    if (matched.length > 15) {
      return '🔍 找到 <b>' + matched.length + '</b> 条匹配订单（超过15条），请缩小搜索范围。<br>'
        + '例如输入更完整的客户名或订单编号。';
    }

    return csShowMatchedOrders(matched, query);
  } catch (err) {
    return '⚠️ 查询出错：' + escapeHtml(err.message || '未知错误') + '<br>请重试。';
  }
}

/**
 * 判断查询是否为客户名查询（需要隐私验证）
 * @param {string} query - 查询关键词
 * @param {Array} plans - 所有计划
 * @returns {boolean}
 */
function csIsCustomerNameQuery(query, plans) {
  if (!query || query.length < 2) return false;
  var lowerQ = query.toLowerCase().trim();
  // 如果查询的是订单编号格式，不需要验证
  if (/^PL-?\d/i.test(lowerQ)) return false;
  // 如果查询的是钢材类型/规格，不需要验证
  var steelMatch = plans.some(function (p) {
    return p.steelType && p.steelType.toLowerCase().indexOf(lowerQ) !== -1;
  });
  var specMatch = plans.some(function (p) {
    return p.specification && p.specification.toLowerCase().indexOf(lowerQ) !== -1;
  });
  // 如果同时匹配到钢材类型，优先认为不是客户查询
  if (steelMatch || specMatch) {
    // 但如果没有匹配到客户名，那就是纯钢材查询
    var customerMatch = plans.some(function (p) {
      return p.customer && p.customer.toLowerCase().indexOf(lowerQ) !== -1;
    });
    if (!customerMatch) return false;
    // 同时匹配到客户和钢材，按客户查询处理
  }
  return true;
}

/**
 * 显示所有订单摘要
 */
function csShowAllOrders(plans) {
  if (plans.length > 20) {
    var html = '📊 系统中共有 <b>' + plans.length + '</b> 条订单，数量较多。<br>'
      + '请通过客户名/钢号/订单号进行精准搜索。<br><br>'
      + '📌 最新 <b>5</b> 条订单：<br>';
    var recent = plans.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, 5);
    recent.forEach(function (p) {
      html += csOrderLine(p);
    });
    return html;
  }
  return csShowMatchedOrders(plans, '全部订单');
}

/**
 * 显示匹配的订单
 */
function csShowMatchedOrders(plans, query) {
  var html = '🔍 关键词「<b>' + escapeHtml(query) + '</b>」找到 <b>' + plans.length + '</b> 条订单：<br><br>';
  plans.slice().sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  }).forEach(function (plan) {
    html += csOrderLine(plan);
  });
  return html;
}

/**
 * 单条订单行
 */
function csOrderLine(plan) {
  var stepLabel = getStepLabel(plan.processStep);
  var progressLabel = getProgressLabel(plan.progressStatus);
  var progressColor = (PROGRESS_STATUS[plan.progressStatus] || PROGRESS_STATUS.pending).color;
  var settleLabel = getSettleLabel(plan.settleStatus || 'unsettled');
  var settleColor = getSettleColor(plan.settleStatus || 'unsettled');
  var statusLabel = plan.status === 'pending' ? '待生产' : plan.status === 'processing' ? '生产中' : plan.status === 'completed' ? '已完成' : '已取消';

  var unpaid = Number(plan.unpaidAmount) || 0;
  var unpaidStr = '';
  if (plan.totalPrice > 0 && unpaid > 0) {
    unpaidStr = ' | <span style="color:#dc2626;">⚠️ 未收 ¥' + formatMoney(unpaid) + '</span>';
  } else if (plan.totalPrice > 0 && unpaid <= 0) {
    unpaidStr = ' | <span style="color:#16a34a;">✅ 已结清</span>';
  }

  var dateStr = plan.deliveryDate ? formatDate(plan.deliveryDate) : '-';

  return '\
    <div class="cs-order-card">\
      <div class="cs-order-header">\
        <span class="cs-order-no">📋 ' + escapeHtml(plan.planNo) + '</span>\
        <span class="status-badge ' + (plan.status === 'pending' ? 'status-pending' : plan.status === 'processing' ? 'status-processing' : plan.status === 'completed' ? 'status-completed' : 'status-cancelled') + '">' + statusLabel + '</span>\
      </div>\
      <div class="cs-order-body">\
        📦 ' + escapeHtml(plan.steelType) + ' | ' + escapeHtml(plan.specification) + ' | ' + plan.quantity + ' ' + escapeHtml(plan.unit) + '<br>\
        🔧 工序: <b>' + escapeHtml(stepLabel) + '</b> | 进度: <span style="color:' + progressColor + ';font-weight:700;">' + progressLabel + '</span> | 📅 交货: ' + dateStr + '<br>\
        ' + (plan.customer ? '🏢 客户: ' + escapeHtml(plan.customer) + ' | ' : '') + '\
        💰 结算: <span style="color:' + settleColor + ';font-weight:700;">' + settleLabel + '</span>' + unpaidStr + '\
      </div>\
    </div>\
  ';
}

/**
 * 显示未结算订单
 */
function csShowUnsettled(plans) {
  var unsettled = plans.filter(function (p) {
    return (p.settleStatus === 'unsettled' || p.settleStatus === 'partial') && p.totalPrice > 0;
  });
  if (unsettled.length === 0) {
    return '🎉 所有订单均已结清，没有待结算的订单！';
  }
  var totalUnpaid = 0;
  unsettled.forEach(function (p) { totalUnpaid += (Number(p.unpaidAmount) || 0); });
  var html = '⚠️ 共有 <b>' + unsettled.length + '</b> 条未结清订单，未收总额：<b style="color:#dc2626;">¥' + formatMoney(totalUnpaid) + '</b><br><br>';
  unsettled.slice().sort(function (a, b) {
    return (Number(b.unpaidAmount) || 0) - (Number(a.unpaidAmount) || 0);
  }).forEach(function (plan) {
    html += csOrderLine(plan);
  });
  return html;
}

/**
 * 显示已完成订单
 */
function csShowCompleted(plans) {
  var completed = plans.filter(function (p) {
    return p.progressStatus === 'completed';
  });
  if (completed.length === 0) {
    return '📋 当前没有已完工的订单。';
  }
  var html = '✅ 共有 <b>' + completed.length + '</b> 条已完工订单：<br><br>';
  completed.slice().sort(function (a, b) {
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  }).forEach(function (plan) {
    html += csOrderLine(plan);
  });
  return html;
}

/**
 * 显示延期订单
 */
function csShowDelayed(plans) {
  var delayed = plans.filter(function (p) {
    return p.progressStatus === 'delayed';
  });
  if (delayed.length === 0) {
    return '✅ 当前没有延期订单！';
  }
  var html = '🔴 共有 <b>' + delayed.length + '</b> 条延期订单：<br><br>';
  delayed.forEach(function (plan) {
    html += csOrderLine(plan);
  });
  return html;
}

/**
 * 显示帮助
 */
function csShowHelp() {
  return '\
    🤖 <b>智能客服使用指南</b><br><br>\
    🔍 <b>查询方式：</b><br>\
    • 输入 <b>客户名称</b> 查询该客户所有订单<br>\
    • 输入 <b>钢材类型/钢号</b> 查询相关订单<br>\
    • 输入 <b>计划编号</b> 精确查询<br>\
    • 输入「<b>全部订单</b>」查看所有记录<br>\
    • 输入「<b>待结算</b>」查看未结清订单<br>\
    • 输入「<b>已完成</b>」查看已完工订单<br>\
    • 输入「<b>延期</b>」查看延期订单<br><br>\
    📊 <b>查询结果包含：</b><br>\
    • 生产工序进度<br>\
    • 进度状态（待加工/加工中/已完成/延期）<br>\
    • 交货日期<br>\
    • 财务结算状态<br>\
    • 未收欠款金额<br><br>\
    💡 <b>数据同步说明：</b><br>\
    客服数据与系统数据实时同步，在三级详情弹窗中修改进度或财务数据后，查询结果即时刷新。\
  ';
}

/**
 * 追加消息到聊天区
 */
function csAppendMessage(type, content) {
  var body = document.getElementById('csChatBody');
  if (!body) return;

  var msgDiv = document.createElement('div');
  msgDiv.className = 'cs-message ' + (type === 'user' ? 'cs-message-user' : 'cs-message-bot');

  if (type === 'bot') {
    msgDiv.innerHTML = '\
      <div class="cs-message-avatar">🤖</div>\
      <div class="cs-message-bubble">' + content + '</div>\
    ';
  } else {
    msgDiv.innerHTML = '\
      <div class="cs-message-bubble">' + escapeHtml(content) + '</div>\
      <div class="cs-message-avatar">👤</div>\
    ';
  }

  body.appendChild(msgDiv);

  // 滚动到底部
  body.scrollTop = body.scrollHeight;
}


/* ===== app.js ===== */
/* ==========================================
   Steel 钢材管理系统 - 应用主入口
   负责：初始化、页面路由切换、全局状态
   v3.0 - 三层架构、智能客服AI、财务深度集成、全站加固
   ========================================== */

// 当前激活的页面
var currentPage = 'form';

/**
 * 应用初始化
 */
function initApp() {
  // 渲染表单页（默认首页）
  renderForm();

  // 初始化智能客服
  if (typeof initCustomerService === 'function') {
    initCustomerService();
  }

  // 绑定键盘快捷键
  bindKeyboardShortcuts();

  console.log('🏭 Steel 钢材管理系统 v3.0 已就绪');
  console.log('   - 数据存储在浏览器 localStorage');
  console.log('   - 当前计划总数: ' + getPlanCount());
  console.log('   - 新功能: 三层架构、智能客服AI、财务深度集成');
}

/**
 * 切换页面
 * @param {string} page - 'form' | 'list'
 */
function switchPage(page) {
  if (currentPage === page) return;
  currentPage = page;

  // 切换页面显示
  var formPage = document.getElementById('page-form');
  var listPage = document.getElementById('page-list');

  if (page === 'form') {
    if (formPage) formPage.classList.remove('hidden');
    if (listPage) listPage.classList.add('hidden');
    renderForm();
  } else if (page === 'list') {
    if (formPage) formPage.classList.add('hidden');
    if (listPage) listPage.classList.remove('hidden');
    renderList();
  }

  // 更新导航按钮激活状态
  updateNavActive(page);

  // 关闭移动端菜单
  closeMobileMenu();

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 更新导航按钮激活状态
 */
function updateNavActive(page) {
  var navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(function (btn) {
    if (btn.getAttribute('data-page') === page) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * 切换移动端菜单
 */
function toggleMobileMenu() {
  var mobileNav = document.getElementById('mobileNav');
  if (!mobileNav) return;

  if (mobileNav.classList.contains('hidden')) {
    mobileNav.classList.remove('hidden');
  } else {
    mobileNav.classList.add('hidden');
  }
}

/**
 * 关闭移动端菜单
 */
function closeMobileMenu() {
  var mobileNav = document.getElementById('mobileNav');
  if (mobileNav) {
    mobileNav.classList.add('hidden');
  }
}

/**
 * 绑定键盘快捷键
 */
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    // Ctrl+1 切换到录入页
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault();
      switchPage('form');
      return;
    }
    // Ctrl+2 切换到列表页
    if (e.ctrlKey && e.key === '2') {
      e.preventDefault();
      switchPage('list');
      return;
    }

    // Escape 关闭弹窗（优先级：客服窗口 > 搜索结果 > 财务表格 > 三级详情 > 二次确认 > 进度弹窗 > 编辑弹窗 > 删除弹窗）
    if (e.key === 'Escape') {
      var csWin = document.getElementById('csChatWindow');
      var searchResultModal = document.getElementById('searchResultModal');
      var financeTableModal = document.getElementById('financeTableModal');
      var detailModal = document.getElementById('detailModal');
      var confirmProgressModal = document.getElementById('confirmProgressModal');
      var progressModal = document.getElementById('progressModal');
      var editModal = document.getElementById('editModal');
      var deleteModal = document.getElementById('deleteModal');

      if (csWin && csWin.classList.contains('cs-open') && !csWin.classList.contains('cs-minimized')) {
        e.preventDefault();
        if (typeof closeCustomerService === 'function') closeCustomerService();
        return;
      }
      if (searchResultModal && searchResultModal.classList.contains('show')) {
        e.preventDefault();
        closeSearchResultModal();
        return;
      }
      if (financeTableModal && financeTableModal.classList.contains('show')) {
        e.preventDefault();
        if (typeof closeFinanceTableModal === 'function') closeFinanceTableModal();
        return;
      }
      if (detailModal && detailModal.classList.contains('show')) {
        e.preventDefault();
        if (typeof closeDetailModal === 'function') closeDetailModal();
        return;
      }
      if (confirmProgressModal && confirmProgressModal.classList.contains('show')) {
        e.preventDefault();
        closeConfirmProgressModal();
        return;
      }
      if (progressModal && progressModal.classList.contains('show')) {
        e.preventDefault();
        closeProgressModal();
        return;
      }
      if (editModal && editModal.classList.contains('show')) {
        e.preventDefault();
        closeEditModal();
        return;
      }
      if (deleteModal && deleteModal.classList.contains('show')) {
        e.preventDefault();
        closeDeleteModal();
        return;
      }
    }

    // 进度弹窗内：左右箭头切换上一单/下一单
    if (typeof progressPlanId !== 'undefined' && progressPlanId) {
      var progressModalEl = document.getElementById('progressModal');
      if (progressModalEl && progressModalEl.classList.contains('show')) {
        // 如果正在输入框中，不拦截箭头键
        var activeEl = document.activeElement;
        var isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
        if (isInput) return;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (typeof progressPlansCache !== 'undefined' && progressPlansCache.length > 0) {
            var currentIdx = progressPlansCache.findIndex(function (p) { return p.id === progressPlanId; });
            if (currentIdx > 0) {
              navigateProgress(progressPlansCache[currentIdx - 1].id);
            }
          }
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (typeof progressPlansCache !== 'undefined' && progressPlansCache.length > 0) {
            var currentIdx2 = progressPlansCache.findIndex(function (p) { return p.id === progressPlanId; });
            if (currentIdx2 < progressPlansCache.length - 1) {
              navigateProgress(progressPlansCache[currentIdx2 + 1].id);
            }
          }
        }
        // Ctrl+S 保存进度
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          if (typeof saveProgress === 'function') {
            saveProgress();
          }
        }
      }
    }
  });
}

// ==========================================
// DOM 加载完成后初始化
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
  initApp();
});


/* ==========================================
   Steel 钢材管理系统 - 数据存储层
   封装所有 localStorage 读写操作
   v2.2 - 新增财务模块（仅三级详情弹窗展示）
   ========================================== */

var STORAGE_KEY = 'steel_production_plans';
var STEEL_TYPES_HISTORY_KEY = 'steel_types_history';

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
    if (!data) return [];
    var plans = JSON.parse(data);
    return plans.map(function (plan) { return normalizePlan(plan); });
  } catch (e) {
    console.error('读取生产计划失败:', e);
    return [];
  }
}

/**
 * 保存所有生产计划到 localStorage
 * @param {Array} plans - 生产计划数组
 */
function savePlans(plans) {
  try {
    var jsonStr = JSON.stringify(plans);
    localStorage.setItem(STORAGE_KEY, jsonStr);
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
 * 导出数据为 Excel (CSV) 格式
 * 包含：计划编号、钢材类型、规格、数量、单位、当前工序、生产进度状态、交货日期、状态、客户、备注
 */
function exportExcel() {
  var plans = getPlans();
  if (plans.length === 0) {
    return { success: false, count: 0, message: '暂无数据可导出' };
  }

  // BOM for Excel 正确识别 UTF-8 中文
  var BOM = '\uFEFF';
  var headers = ['计划编号', '钢材类型', '规格', '数量', '单位', '当前工序', '生产进度状态', '交货日期', '生产状态', '客户', '备注', '创建时间'];

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
    return { success: true, count: plans.length, message: 'Excel 导出成功！共 ' + plans.length + ' 条记录' };
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

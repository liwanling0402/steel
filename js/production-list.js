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

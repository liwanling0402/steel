/* ==========================================
   Steel 钢材管理系统 - 生产计划列表模块
   v2.1 - 进度统计面板、进度弹窗、上一单/下一单、
          行交互、Excel导出、操作日志、防误触
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

/**
 * 渲染生产计划列表页面
 */
function renderList() {
  var container = document.getElementById('listContainer');
  if (!container) return;

  var plans = getPlans();

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
          <button class="btn-secondary text-sm py-2 px-3" onclick="handleExportExcel()" title="导出Excel(CSV)">\
            📊 Excel\
          </button>\
          <button class="btn-secondary text-sm py-2 px-3" onclick="document.getElementById(\'importFile\').click()" title="导入数据">\
            📤 导入\
          </button>\
          <input type="file" id="importFile" accept=".json" class="hidden" onchange="handleImport(event)" />\
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
          <tr class="table-row-clickable hover:bg-gray-50 transition-colors" data-id="' + plan.id + '" onclick="openProgressModal(\'' + plan.id + '\')" title="点击管理进度">\
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
                <button class="text-green-600 hover:text-green-800 hover:bg-green-50 p-1.5 rounded transition-colors text-xs font-medium" onclick="openProgressModal(\'' + plan.id + '\')" title="管理进度">进度</button>\
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
      <div class="card-hover mobile-card-clickable bg-white border border-gray-200 rounded-lg p-4" data-id="' + plan.id + '" onclick="openProgressModal(\'' + plan.id + '\')">\
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
          <button class="flex-1 text-center text-green-600 hover:bg-green-50 py-2 rounded text-sm font-medium transition-colors" onclick="openProgressModal(\'' + plan.id + '\')">🔧 进度</button>\
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

  var handler = function () {
    var keyword = (searchInput && searchInput.value || '').toLowerCase().trim();
    var status = statusFilter && statusFilter.value || 'all';

    var plans = getPlans();
    var filtered = plans.filter(function (plan) {
      if (status !== 'all' && plan.status !== status) return false;
      if (keyword) {
        var searchStr = (plan.planNo + ' ' + plan.steelType + ' ' + plan.specification + ' ' + plan.customer).toLowerCase();
        if (searchStr.indexOf(keyword) === -1) return false;
      }
      return true;
    });

    renderProgressStats(filtered);
    renderStats(filtered);
    renderListContent(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', handler);
  if (statusFilter) statusFilter.addEventListener('change', handler);
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
  var filtered = plans.filter(function (plan) {
    if (st !== 'all' && plan.status !== st) return false;
    if (kw) {
      var searchStr = (plan.planNo + ' ' + plan.steelType + ' ' + plan.specification + ' ' + plan.customer).toLowerCase();
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

  var steelTypes = ['热轧卷板', '冷轧卷板', '镀锌卷板', '中厚板', '螺纹钢', '线材', '型钢', '无缝钢管', '焊管', '不锈钢板'];
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
            <select id="editSteelType" class="form-select">\
              <option value="">请选择</option>\
              ' + steelTypes.map(function (t) { return '<option value="' + t + '"' + (plan && plan.steelType === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '\
            </select>\
            <p class="form-error-msg" id="editSteelTypeError">请选择钢材类型</p>\
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
      showToast('计划更新成功！', 'success');
    } else {
      addPlan(data);
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
      var searchStr = (plan.planNo + ' ' + plan.steelType + ' ' + plan.specification + ' ' + plan.customer).toLowerCase();
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
  var plan = getPlanById(id);
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
 * 导出 Excel (CSV)（包装 showToast）
 */
function handleExportExcel() {
  var result = exportExcel();
  if (result && result.success) {
    showToast(result.message, 'success');
  } else if (result && result.message) {
    showToast(result.message, 'warning');
  }
}

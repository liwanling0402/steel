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

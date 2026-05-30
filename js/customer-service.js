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

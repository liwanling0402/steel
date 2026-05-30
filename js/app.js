/* ==========================================
   Steel 钢材管理系统 - 应用主入口
   负责：初始化、页面路由切换、全局状态
   v2.0 - 进度弹窗快捷键支持
   ========================================== */

// 当前激活的页面
var currentPage = 'form';

/**
 * 应用初始化
 */
function initApp() {
  // 渲染表单页（默认首页）
  renderForm();

  // 绑定键盘快捷键
  bindKeyboardShortcuts();

  console.log('🏭 Steel 钢材管理系统 v2.0 已就绪');
  console.log('   - 数据存储在浏览器 localStorage');
  console.log('   - 当前计划总数: ' + getPlanCount());
  console.log('   - 新功能: 进度管理、工序跟踪、Excel导出');
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

    // Escape 关闭弹窗（优先级：二次确认 > 进度弹窗 > 编辑弹窗 > 删除弹窗）
    if (e.key === 'Escape') {
      var confirmProgressModal = document.getElementById('confirmProgressModal');
      var progressModal = document.getElementById('progressModal');
      var editModal = document.getElementById('editModal');
      var deleteModal = document.getElementById('deleteModal');

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

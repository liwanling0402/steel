# Steel 钢材加工生产管理系统 v4.0

## 可直接打包安卓APK的完整项目

---

## 项目结构

```
steel/
├── index-app.html          ← 主入口（APP专用，去除CDN依赖，内联关键CSS）
├── index.html              ← Web版入口（含Tailwind CDN，浏览器使用）
├── manifest.json           ← HBuilderX APP配置文件（沉浸式全屏、隐藏状态栏）
├── pages.json              ← uni-app 页面路由配置
├── uni.scss                ← 全局主题变量
├── css/
│   └── style.css           ← 完整样式表（1733行，工业极简高级风）
└── js/
    ├── app-bundle.js       ← ★ 合并版JS（APP加载单文件，零外部依赖）
    ├── app.js              ← 应用主入口（模块版）
    ├── storage.js          ← 数据存储层（模块版）
    ├── production-form.js  ← 生产录入（模块版）
    ├── production-list.js  ← 生产列表+财务（模块版）
    └── customer-service.js ← 智能客服（模块版）
```

---

## 打包安卓APK步骤

### 方法一：HBuilderX（推荐）

1. 打开 HBuilderX → 文件 → 导入 → 从本地目录导入
2. 选择 `steel/` 文件夹
3. 右键项目 → 发行 → 原生App-云打包
4. 选择 Android → 使用公共测试证书 → 打包
5. 等待打包完成，下载 APK

### 方法二：直接使用（无需打包）

1. 用手机浏览器打开 `http://你的电脑IP:5500`
2. 添加至主屏幕 → 即可作为PWA使用

---

## 功能清单

- ✅ 生产计划录入（钢材类型、规格、数量、客户、交货日期）
- ✅ 生产计划列表（搜索、筛选、排序、统计）
- ✅ 七级工序进度管理（原料准备→成品出库）
- ✅ 三级私密财务管理（单价、回款记录、对账备注）
- ✅ 财务对账表格（全量订单在线编辑、实时计算、批量保存）
- ✅ 智能客服（自然语言查询、快捷指令）
- ✅ 数据本地存储（localStorage + 每日自动存档）
- ✅ Excel/CSV 导出（含全部财务字段）
- ✅ 历史数据查询
- ✅ 数据导入/导出（JSON格式）

---

## 技术要求

- Android 5.0+ (API 21+)
- 无需任何后端服务
- 数据全部存储在手机本地
- 完全离线可用

---

## 开发

```bash
# 本地预览
npx serve -p 5500 .

# 或使用 Python
python -m http.server 5500
```

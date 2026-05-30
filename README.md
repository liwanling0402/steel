# Steel - 钢材加工生产管理系统

一个纯前端的钢材加工生产计划管理系统，支持生产计划的录入、查询、编辑、删除，以及数据的导入导出。

## 技术栈

- HTML5
- CSS3（Tailwind CSS CDN）
- 原生 JavaScript（无框架）
- localStorage 本地数据存储

## 功能模块

1. **生产计划录入** — 录入钢材加工计划（计划编号、钢材类型、规格、数量、交货日期、状态等）
2. **生产计划列表** — 查看全部计划，支持关键词搜索和状态筛选
3. **数据管理** — 编辑、删除计划，支持 JSON 格式的数据导入/导出
4. **响应式布局** — 桌面端表格展示，移动端自动切换为卡片布局

## 项目结构

```
steel/
├── index.html              # 主页面
├── css/
│   └── style.css           # 自定义样式
├── js/
│   ├── app.js              # 应用入口，页面路由
│   ├── storage.js          # localStorage 数据层
│   ├── production-form.js  # 录入表单模块
│   └── production-list.js  # 列表展示模块
└── README.md               # 本文件
```

## 本地运行

直接用浏览器打开 `index.html` 即可，无需任何构建工具或服务器。

```
双击 steel/index.html
```

或者使用任意静态服务器：

```
cd steel
npx serve .
# 或
python -m http.server 8080
```

## 部署到 GitHub Pages

### 方法一：推送整个 steel 目录

1. 在 GitHub 创建仓库，例如 `steel-management`
2. 将 `steel` 目录下的所有文件推送到仓库根目录

```bash
cd steel
git init
git add .
git commit -m "feat: steel management system"
git remote add origin https://github.com/你的用户名/steel-management.git
git branch -M main
git push -u origin main
```

3. 进入仓库 Settings → Pages
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`，目录选择 `/ (root)`
6. 点击 Save，稍等片刻即可通过 `https://你的用户名.github.io/steel-management` 访问

### 方法二：使用 gh-pages 分支

```bash
cd steel
git init
git add .
git commit -m "feat: steel management system"
git branch -M main
git remote add origin https://github.com/你的用户名/steel-management.git
git push -u origin main
```

然后 Settings → Pages → Source 选择 `GitHub Actions` 或 `main` 分支。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + 1` | 切换到生产计划录入页 |
| `Ctrl + 2` | 切换到生产计划列表页 |
| `Esc` | 关闭弹窗 |

## 注意事项

- 数据存储在浏览器 localStorage 中，清除浏览器数据会导致数据丢失
- 建议定期使用「导出」功能备份数据
- 不同浏览器之间的数据不互通

# Plan · 任务排期看板

一个纯前端、开箱即用的任务排期看板。以三栏看板为核心，配合日历与甘特式时间线，帮助团队把「待办 → 进行中 → 已完成」的排期节奏看得清清楚楚。

> **在线演示**：https://flywheel1412.github.io/Plan/

## 界面预览

**看板视图** — 拖拽卡片跨列调整状态，逾期任务自动高亮

![看板视图](./docs/preview-board.png)

**日历视图** — 按截止日期铺开任务，点击日期即可快速新建

![日历视图](./docs/preview-calendar.png)

**时间线视图** — 甘特式任务条展示排期区间与今日位置

![时间线视图](./docs/preview-timeline.png)


## 功能特性

- **三栏看板 + 拖拽**：待办 / 进行中 / 已完成，支持跨列移动与列内排序，拖拽后自动持久化。
- **完整排期字段**：标题、描述、优先级（P0–P3）、负责人、标签、开始/截止日期、预估工时。
- **日历视图**：按月查看截止任务，逾期任务高亮，点击任意日期即可快速新建任务。
- **时间线视图**：甘特式任务条展示起止区间，自动定位「今天」，按负责人与排期排序。
- **筛选与搜索**：关键词搜索（标题/描述/标签/负责人）、优先级、负责人、标签筛选，以及「已逾期 / 本周到期 / 高优先级」快捷筛选。
- **统计概览**：任务总数、进行中、完成率环形进度、逾期风险与剩余预估工时。
- **本地优先**：数据自动保存在浏览器 `localStorage`，无需后端；支持一键导出 / 导入 JSON 备份。
- **体验细节**：浅色 / 深色主题、响应式布局、快捷键 `N` 新建任务、动效与空状态。
- **键盘可用**：卡片支持 `Space` 拖起、方向键移动、再次 `Space` 放下。

## 技术栈

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/) + TypeScript
- [@dnd-kit](https://dndkit.com/)（拖拽与排序）
- [date-fns](https://date-fns.org/)（日期计算，中文 locale）
- [lucide-react](https://lucide.dev/)（图标）
- 原生 CSS 变量设计系统，无 UI 框架依赖

## 快速开始

```bash
npm install
npm run dev        # 本地开发，默认 http://127.0.0.1:5180
npm run build      # 类型检查 + 生产构建，产物在 dist/
npm run preview    # 预览生产构建
```

构建产物是纯静态文件，可部署到 GitHub Pages、Vercel、Netlify 或任意静态服务器（`vite.config.ts` 已设置 `base: "./"`，支持子路径托管）。

## 部署

仓库已配置 GitHub Actions 自动部署（`.github/workflows/deploy.yml`）：推送到 `master` 分支后自动执行 `npm ci && npm run build`，并通过 `actions/deploy-pages` 发布到 GitHub Pages。

- **线上地址**：https://flywheel1412.github.io/Plan/
- 也可在仓库 **Actions → Deploy to GitHub Pages** 中手动触发（`workflow_dispatch`）。
- 若使用自有域名，可在 **Settings → Pages → Custom domain** 中配置。

### 内网 Gitea 镜像

- 源码镜像：由内网 Gitea 的 `jingxu/plan-kanban` 仓库保存（访问地址见内部文档）。
- 说明：Gitea 1.27.3 不提供内置静态 Pages，且 raw 文件被强制以 `text/plain` + CSP sandbox 返回，无法直接承载 HTML/JS；因此网页托管以 GitHub Pages 为准，Gitea 仅保存源码镜像。
- 更新镜像：在能同时访问 GitHub 与内网 Gitea 的机器上，用 `git clone --mirror` 克隆本仓库并推送到内网镜像仓库。

## 数据与备份

- 数据保存在浏览器 `localStorage` 的 `plan-kanban.tasks.v1` 键中，刷新不丢失。
- 顶部「⋯」菜单可**导出 JSON**、**导入 JSON**、**恢复示例数据**。
- 首次打开会载入 12 条中文示例任务，可随时恢复。
- 导入时仅校验标题与状态，未知字段会被安全忽略。

任务数据结构：

```ts
interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "done";
  priority: "P0" | "P1" | "P2" | "P3";
  assignee: string;
  tags: string[];
  startDate: string | null; // YYYY-MM-DD
  dueDate: string | null;   // YYYY-MM-DD
  estimate: number | null;  // 小时
  order: number;
  createdAt: string;
  updatedAt: string;
}
```

## 快捷键

| 按键 | 行为 |
| --- | --- |
| `N` | 新建任务（输入框聚焦时不会触发） |
| `Space` | 聚焦卡片后拖起 / 放下 |
| `↑ ↓ ← →` | 拖动时移动卡片 |
| `Esc` | 关闭弹窗或取消拖拽 |

## 目录结构

```
src/
├─ App.tsx                 # 页面状态、筛选、导入导出
├─ components/
│  ├─ Header.tsx           # 顶部导航与操作菜单
│  ├─ StatsBar.tsx         # 统计概览
│  ├─ FilterBar.tsx        # 搜索与筛选
│  ├─ Board.tsx            # 看板与拖拽上下文
│  ├─ TaskCard.tsx         # 任务卡片
│  ├─ TaskModal.tsx        # 新建 / 编辑弹窗
│  ├─ CalendarView.tsx     # 日历视图
│  └─ TimelineView.tsx     # 时间线视图
├─ hooks/useTasks.ts       # 任务 CRUD、排序与持久化
├─ data/seed.ts            # 示例数据
├─ utils/date.ts           # 日期工具
└─ styles.css              # 设计系统与主题
```

## 说明

本项目为纯前端演示 / 个人或小团队轻量排期工具，数据只存在本机浏览器中，不包含账号体系与服务端同步。若需要多人协作，可在此基础上接入后端 API 或 GitHub Issues。

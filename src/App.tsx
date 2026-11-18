import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Keyboard, X } from "lucide-react";
import { Board } from "./components/Board";
import { CalendarView } from "./components/CalendarView";
import { FilterBar } from "./components/FilterBar";
import { Header } from "./components/Header";
import { StatsBar } from "./components/StatsBar";
import { TaskModal } from "./components/TaskModal";
import { TimelineView } from "./components/TimelineView";
import { useTasks } from "./hooks/useTasks";
import type { Filters, Status, Task, ViewKey } from "./types";
import { isDueThisWeek, isOverdue, todayISO } from "./utils/date";

const DEFAULT_FILTERS: Filters = {
  query: "",
  priority: "all",
  assignee: "all",
  tag: "all",
  quick: "all",
};

const THEME_KEY = "plan-kanban.theme";

const readTheme = (): "light" | "dark" => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "light";
};

export default function App() {
  const store = useTasks();
  const [view, setView] = useState<ViewKey>("board");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalDefaults, setModalDefaults] = useState<{
    status?: Status;
    dueDate?: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const visibleTasks = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return store.tasks.filter((task) => {
      if (query) {
        const haystack =
          `${task.title} ${task.description} ${task.assignee} ${task.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      if (filters.assignee !== "all" && task.assignee !== filters.assignee) return false;
      if (filters.tag !== "all" && !task.tags.includes(filters.tag)) return false;
      if (
        filters.quick === "overdue" &&
        !isOverdue(task.dueDate, task.status === "done")
      )
        return false;
      if (
        filters.quick === "week" &&
        !(task.dueDate && isDueThisWeek(task.dueDate) && task.status !== "done")
      )
        return false;
      if (
        filters.quick === "high" &&
        !(task.priority === "P0" || task.priority === "P1")
      )
        return false;
      return true;
    });
  }, [store.tasks, filters]);

  const openNewTask = useCallback((status?: Status, dueDate?: string) => {
    setEditingTask(null);
    setModalDefaults({ status, dueDate });
    setModalOpen(true);
  }, []);

  const openEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setModalDefaults(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const handleSave = useCallback(
    (id: string | null, draft: Partial<Task>) => {
      if (id) {
        const current = store.tasks.find((t) => t.id === id);
        store.updateTask(id, draft);
        if (current && draft.status && draft.status !== current.status) {
          store.moveTask(id, draft.status);
        }
        showToast("任务已更新");
      } else {
        store.createTask(draft);
        showToast("任务已创建");
      }
      setModalOpen(false);
    },
    [store, showToast],
  );

  const handleDelete = useCallback(
    (id: string) => {
      store.deleteTask(id);
      setModalOpen(false);
      showToast("任务已删除");
    },
    [store, showToast],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(store.tasks, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plan-tasks-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("已导出任务数据");
  }, [store.tasks, showToast]);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("invalid");
      const now = new Date().toISOString();
      const tasks: Task[] = parsed
        .filter(
          (item) =>
            item &&
            typeof item.title === "string" &&
            ["todo", "doing", "done"].includes(item.status),
        )
        .map((item, index) => ({
          id: typeof item.id === "string" ? item.id : `import-${Date.now()}-${index}`,
          title: item.title,
          description: typeof item.description === "string" ? item.description : "",
          status: item.status as Status,
          priority: ["P0", "P1", "P2", "P3"].includes(item.priority)
            ? item.priority
            : "P2",
          assignee: typeof item.assignee === "string" ? item.assignee : "",
          tags: Array.isArray(item.tags)
            ? item.tags.filter((tag: unknown) => typeof tag === "string")
            : [],
          startDate: typeof item.startDate === "string" ? item.startDate : null,
          dueDate: typeof item.dueDate === "string" ? item.dueDate : null,
          estimate: typeof item.estimate === "number" ? item.estimate : null,
          order: typeof item.order === "number" ? item.order : index,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
          updatedAt: now,
        }));
      if (!tasks.length) throw new Error("empty");
      store.replaceAll(tasks);
      showToast(`已导入 ${tasks.length} 个任务`);
    } catch {
      showToast("导入失败：请选择由本应用导出的 JSON 文件");
    }
  };

  const handleReset = () => {
    if (!window.confirm("确定恢复示例数据吗？当前任务会被覆盖。")) return;
    store.resetSeed();
    showToast("已恢复示例数据");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (modalOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openNewTask();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, openNewTask]);

  const hasScheduled = store.tasks.some((t) => t.startDate || t.dueDate);

  return (
    <div className="app-shell">
      <Header
        view={view}
        onChangeView={setView}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        onNewTask={() => openNewTask()}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onReset={handleReset}
        taskCount={store.tasks.length}
      />

      <main className="app-main">
        <StatsBar tasks={store.tasks} />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          assignees={store.assignees}
          tags={store.tags}
          resultCount={visibleTasks.length}
          totalCount={store.tasks.length}
        />

        {visibleTasks.length === 0 && store.tasks.length > 0 ? (
          <div className="empty-state filter-empty">
            <AlertCircle size={30} />
            <p>没有符合当前筛选条件的任务</p>
            <span>试试更换关键词或清除筛选条件。</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              <X size={15} />
              清除筛选
            </button>
          </div>
        ) : view === "board" ? (
          <Board
            tasks={visibleTasks}
            allTasks={store.tasks}
            onEdit={openEditTask}
            onAdd={(status) => openNewTask(status)}
            moveTask={store.moveTask}
            reorderTask={store.reorderTask}
          />
        ) : view === "calendar" ? (
          <CalendarView
            tasks={visibleTasks}
            onEdit={openEditTask}
            onCreate={(date) => openNewTask("todo", date)}
          />
        ) : (
          <TimelineView tasks={visibleTasks} onEdit={openEditTask} />
        )}

        {view === "board" && hasScheduled && (
          <p className="board-footnote">
            <Keyboard size={14} />
            小提示：按 <kbd>N</kbd> 快速新建任务，拖动卡片可跨列调整状态。
          </p>
        )}

        <footer className="app-footer">
          <span>Plan · 任务排期看板</span>
          <span>数据自动保存在当前浏览器的 localStorage</span>
        </footer>
      </main>

      <TaskModal
        open={modalOpen}
        task={editingTask}
        defaults={modalDefaults}
        assignees={store.assignees}
        allTags={store.tags}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden-input"
        onChange={handleImportFile}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

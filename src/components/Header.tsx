import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Columns3,
  Download,
  GanttChartSquare,
  Moon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Sun,
  Upload,
} from "lucide-react";
import type { ViewKey } from "../types";
import { VIEW_LABEL } from "../types";

interface HeaderProps {
  view: ViewKey;
  onChangeView: (view: ViewKey) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNewTask: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  taskCount: number;
}

const VIEW_ICONS = {
  board: Columns3,
  calendar: CalendarDays,
  timeline: GanttChartSquare,
} as const;

export function Header({
  view,
  onChangeView,
  theme,
  onToggleTheme,
  onNewTask,
  onExport,
  onImport,
  onReset,
  taskCount,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-text">
            <div className="brand-title">
              Plan
              <span className="brand-badge">排期看板</span>
            </div>
            <div className="brand-sub">共 {taskCount} 个任务 · 数据保存在本机</div>
          </div>
        </div>

        <nav className="view-switch" aria-label="视图切换">
          {(Object.keys(VIEW_LABEL) as ViewKey[]).map((key) => {
            const Icon = VIEW_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                className={view === key ? "view-tab active" : "view-tab"}
                onClick={() => onChangeView(key)}
              >
                <Icon size={16} strokeWidth={2.2} />
                <span>{VIEW_LABEL[key]}</span>
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            title={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
            aria-label="切换主题"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="更多操作"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    onExport();
                    setMenuOpen(false);
                  }}
                >
                  <Download size={16} />
                  导出 JSON 备份
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    onImport();
                    setMenuOpen(false);
                  }}
                >
                  <Upload size={16} />
                  导入 JSON 数据
                </button>
                <div className="menu-sep" />
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    onReset();
                    setMenuOpen(false);
                  }}
                >
                  <RotateCcw size={16} />
                  恢复示例数据
                </button>
              </div>
            )}
          </div>

          <button type="button" className="btn btn-primary" onClick={onNewTask}>
            <Plus size={17} strokeWidth={2.4} />
            <span>新建任务</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function BoardHint() {
  return (
    <span className="board-hint">
      <Check size={14} /> 拖动卡片可跨列调整状态
    </span>
  );
}

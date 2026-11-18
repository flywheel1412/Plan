import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Cloud,
  Columns3,
  Download,
  GanttChartSquare,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Upload,
} from "lucide-react";
import type { ViewKey } from "../types";
import { VIEW_LABEL } from "../types";

export interface RemoteHeaderInfo {
  user: { name: string; username: string };
  syncing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

interface HeaderProps {
  view: ViewKey;
  onChangeView: (view: ViewKey) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNewTask: () => void;
  onExport: () => void;
  onImport?: () => void;
  onReset?: () => void;
  taskCount: number;
  remote?: RemoteHeaderInfo;
}

const VIEW_ICONS = {
  today: Sun,
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
  remote,
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
          <div className="brand-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 26 26" fill="currentColor"><path d="M3 5h18l-3 4H3zm0 7h14l-3 4H3zm0 7h9l-3 4H3z" /></svg></div>
          <div className="brand-text">
            <div className="brand-title">
              Plan
              <span className="brand-badge">WORKSPACE</span>
            </div>
            <div className="brand-sub">
              {remote
                ? remote.syncing
                  ? "正在同步 GitLab…"
                  : `已连接 GitLab · ${remote.user.name || remote.user.username}`
                : `共 ${taskCount} 个任务 · 数据保存在本机`}
            </div>
          </div>
        </div>

        <nav className="view-switch" aria-label="视图切换">
          {(Object.keys(VIEW_LABEL) as ViewKey[]).map((key) => {
            const Icon = VIEW_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                aria-label={VIEW_LABEL[key]}
                aria-pressed={view === key}
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
          {remote && (
            <div
              className="remote-chip"
              title={`已连接 GitLab：${remote.user.username}`}
            >
              <span className={remote.syncing ? "sync-dot syncing" : "sync-dot"} />
              <Cloud size={13} />
              <span>{remote.user.name || remote.user.username}</span>
            </div>
          )}

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
                {remote && (
                  <button
                    type="button"
                    className="menu-item"
                    disabled={remote.syncing}
                    onClick={() => {
                      remote.onRefresh();
                      setMenuOpen(false);
                    }}
                  >
                    <RefreshCw size={16} className={remote.syncing ? "spin" : undefined} />
                    {remote.syncing ? "正在同步…" : "刷新 GitLab 数据"}
                  </button>
                )}
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
                {!remote && onImport && (
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
                )}
                <div className="menu-sep" />
                {remote ? (
                  <button
                    type="button"
                    className="menu-item danger"
                    onClick={() => {
                      remote.onLogout();
                      setMenuOpen(false);
                    }}
                  >
                    <LogOut size={16} />
                    退出 GitLab 登录
                  </button>
                ) : (
                  onReset && (
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
                  )
                )}
              </div>
            )}
          </div>

          <button type="button" className="btn btn-primary" aria-label="新建任务" onClick={onNewTask}>
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

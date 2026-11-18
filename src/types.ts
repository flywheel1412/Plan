export type Status = "todo" | "doing" | "done";
export type Priority = "P0" | "P1" | "P2" | "P3";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee: string;
  tags: string[];
  startDate: string | null;
  dueDate: string | null;
  estimate: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnMeta {
  id: Status;
  title: string;
  hint: string;
  accent: string;
}

export const COLUMNS: ColumnMeta[] = [
  { id: "todo", title: "待办", hint: "已收集，等待排期", accent: "#64748b" },
  { id: "doing", title: "进行中", hint: "本周重点推进", accent: "#6366f1" },
  { id: "done", title: "已完成", hint: "已交付并验收", accent: "#10b981" },
];

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; bg: string; border: string }
> = {
  P0: { label: "P0 紧急", color: "#e11d48", bg: "#fff1f2", border: "#fecdd3" },
  P1: { label: "P1 高", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  P2: { label: "P2 中", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  P3: { label: "P3 低", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
};

export const PRIORITY_ORDER: Priority[] = ["P0", "P1", "P2", "P3"];

export const STATUS_LABEL: Record<Status, string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
};

export const VIEW_LABEL = {
  board: "看板",
  calendar: "日历",
  timeline: "时间线",
} as const;

export type ViewKey = keyof typeof VIEW_LABEL;

export interface Filters {
  query: string;
  priority: Priority | "all";
  assignee: string | "all";
  tag: string | "all";
  quick: "all" | "overdue" | "week" | "high";
}

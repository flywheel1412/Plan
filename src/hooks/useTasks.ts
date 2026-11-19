import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Status, Task } from "../types";
import { seedTasks } from "../data/seed";

const STORAGE_KEY = "plan-kanban.tasks.v1";

const rid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeOrder = (tasks: Task[]): Task[] => {
  const grouped = new Map<Status, Task[]>();
  (["todo", "doing", "postponed", "done"] as Status[]).forEach((s) => grouped.set(s, []));
  tasks.forEach((t) => grouped.get(t.status)?.push(t));
  const next: Task[] = [];
  grouped.forEach((list) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((t, i) => next.push(t.order === i ? t : { ...t, order: i }));
  });
  return next;
};

const load = (): Task[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedTasks;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedTasks;
    return normalizeOrder(parsed as Task[]);
  } catch {
    return seedTasks;
  }
};

export interface TaskStore {
  tasks: Task[];
  createTask: (draft: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: Status, index?: number) => void;
  reorderTask: (id: string, overId: string) => void;
  replaceAll: (tasks: Task[]) => void;
  resetSeed: () => void;
  assignees: string[];
  tags: string[];
}

export function useTasks(): TaskStore {
  const [tasks, setTasks] = useState<Task[]>(load);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* storage may be full or unavailable */
    }
  }, [tasks]);

  const createTask = useCallback((draft: Partial<Task>) => {
    const id = rid();
    const now = new Date().toISOString();
    let created!: Task;
    setTasks((prev) => {
      const status = draft.status ?? "todo";
      const maxOrder = prev
        .filter((t) => t.status === status)
        .reduce((m, t) => Math.max(m, t.order), -1);
      created = {
        id,
        title: draft.title?.trim() || "未命名任务",
        description: draft.description ?? "",
        status,
        priority: draft.priority ?? "P2",
        assignee: draft.assignee?.trim() ?? "",
        tags: draft.tags ?? [],
        startDate: draft.startDate ?? null,
        dueDate: draft.dueDate ?? null,
        estimate: draft.estimate ?? null,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      };
      return [...prev, created];
    });
    return { ...created, id };
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...patch, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveTask = useCallback((id: string, status: Status, index?: number) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      const target = prev
        .filter((t) => t.status === status && t.id !== id)
        .sort((a, b) => a.order - b.order);
      const at = index === undefined ? target.length : Math.min(Math.max(index, 0), target.length);
      const ordered = [...target.slice(0, at), { ...task, status }, ...target.slice(at)];
      const orderMap = new Map(ordered.map((t, i) => [t.id, i]));
      return prev.map((t) => {
        if (t.id === id) return { ...t, status, order: orderMap.get(id) ?? 0, updatedAt: new Date().toISOString() };
        if (t.status === status) return orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)! } : t;
        return t;
      });
    });
  }, []);

  const reorderTask = useCallback((id: string, overId: string) => {
    setTasks((prev) => {
      const moving = prev.find((t) => t.id === id);
      const over = prev.find((t) => t.id === overId);
      if (!moving || !over || moving.status !== over.status) return prev;
      const list = prev
        .filter((t) => t.status === moving.status)
        .sort((a, b) => a.order - b.order);
      const from = list.findIndex((t) => t.id === id);
      const to = list.findIndex((t) => t.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...list];
      next.splice(to, 0, next.splice(from, 1)[0]);
      const orderMap = new Map(next.map((t, i) => [t.id, i]));
      return prev.map((t) =>
        orderMap.has(t.id) && t.status === moving.status
          ? { ...t, order: orderMap.get(t.id)! }
          : t,
      );
    });
  }, []);

  const replaceAll = useCallback((incoming: Task[]) => {
    setTasks(normalizeOrder(incoming));
  }, []);

  const resetSeed = useCallback(() => {
    setTasks(seedTasks.map((t) => ({ ...t })));
  }, []);

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))).sort(),
    [tasks],
  );

  const tags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks],
  );

  return {
    tasks,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTask,
    replaceAll,
    resetSeed,
    assignees,
    tags,
  };
}

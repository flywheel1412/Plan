import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitLabConfig } from "../config";
import {
  GitLabApi,
  GitLabApiError,
  type GitLabMember,
  type GitLabUser,
} from "../gitlab/api";
import {
  AuthRequiredError,
  beginLogin,
  clearTokens,
  completeOAuthCallback,
  hasTokens,
  revokeTokens,
} from "../gitlab/oauth";
import {
  BASE_LABELS,
  issueToTask,
  tagColor,
  tagLabel,
  taskSignature,
  taskToIssuePayload,
} from "../gitlab/mapping";
import type { Status, Task } from "../types";
import { seedTasks } from "../data/seed";
import type { TaskStore } from "./useTasks";
import { uid } from "../utils/ui";

const LOCAL_TASKS_KEY = "plan-kanban.tasks.v1";

export type AuthStatus = "loading" | "none" | "ready" | "error";

export interface GitLabStore extends TaskStore {
  mode: "gitlab";
  authStatus: AuthStatus;
  user: GitLabUser | null;
  syncing: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  importLocalTasks: () => Promise<number>;
  seedDemoTasks: () => Promise<number>;
}

function errorText(error: unknown): string {
  if (error instanceof AuthRequiredError) {
    return "GitLab 登录已过期，请重新登录。";
  }
  if (error instanceof GitLabApiError) {
    if (error.status === 401) return "GitLab 登录已过期，请重新登录。";
    if (error.status === 403) return "当前账号没有足够权限操作该项目。";
    if (error.status === 404) return "无法访问 GitLab 项目，请确认当前账号有项目权限。";
    if (error.status === 429) return "GitLab API 请求过于频繁，请稍后重试。";
    return `GitLab 操作失败：${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return "GitLab 操作失败";
}

function sortTasks(tasks: Task[]): Task[] {
  const statusRank: Record<Status, number> = { todo: 0, doing: 1, done: 2 };
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status];
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function useGitLabTasks(config: GitLabConfig): GitLabStore {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiRef = useRef<GitLabApi | null>(null);
  const tasksRef = useRef<Task[]>(tasks);
  const membersRef = useRef<GitLabMember[]>([]);
  const lastSyncedRef = useRef(new Map<number, string>());
  const labelsRef = useRef(new Set<string>());
  const hydratedRef = useRef(false);
  const disposedRef = useRef(false);
  const deletedTempRef = useRef(new Set<string>());
  const syncTimerRef = useRef<number | undefined>(undefined);

  tasksRef.current = tasks;

  const ensureLabel = useCallback(async (name: string, color: string) => {
    const api = apiRef.current;
    if (!api || labelsRef.current.has(name)) return;
    await api.createLabel(name, color);
    labelsRef.current.add(name);
  }, []);

  const ensureLabelsForTask = useCallback(
    async (task: Task) => {
      for (const label of BASE_LABELS) {
        await ensureLabel(label.name, label.color);
      }
      for (const tag of Array.from(new Set(task.tags.filter(Boolean)))) {
        await ensureLabel(tagLabel(tag), tagColor(tag));
      }
    },
    [ensureLabel],
  );

  const load = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    setSyncing(true);
    setError(null);
    try {
      const [me, , members, labels, issues] = await Promise.all([
        api.getCurrentUser(),
        api.getProject(),
        api.listMembers(),
        api.listLabels(),
        api.listIssues(),
      ]);
      if (disposedRef.current) return;
      labelsRef.current = new Set(labels.map((label) => label.name));
      membersRef.current = members;
      const mapped = sortTasks(issues.map(issueToTask));
      lastSyncedRef.current = new Map(
        mapped
          .filter((task) => task.iid != null)
          .map((task) => [task.iid as number, taskSignature(task)]),
      );
      hydratedRef.current = true;
      setTasks(mapped);
      setUser(me);
      setAuthStatus("ready");
    } catch (caught) {
      if (caught instanceof AuthRequiredError) {
        clearTokens();
        setAuthStatus("none");
      } else {
        setError(errorText(caught));
        setAuthStatus("error");
      }
    } finally {
      if (!disposedRef.current) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    apiRef.current = new GitLabApi(config);
    setAuthStatus("loading");
    setError(null);
    void (async () => {
      try {
        await completeOAuthCallback(config);
        if (!hasTokens()) {
          setAuthStatus("none");
          return;
        }
        await load();
      } catch (caught) {
        if (caught instanceof AuthRequiredError) {
          setAuthStatus("none");
        } else {
          setError(errorText(caught));
          setAuthStatus("error");
        }
      }
    })();
    return () => {
      disposedRef.current = true;
      window.clearTimeout(syncTimerRef.current);
    };
  }, [config, load]);

  const login = useCallback(() => {
    void beginLogin(config);
  }, [config]);

  const logout = useCallback(() => {
    void revokeTokens(config);
    clearTokens();
    hydratedRef.current = false;
    lastSyncedRef.current.clear();
    membersRef.current = [];
    setTasks([]);
    setUser(null);
    setError(null);
    setAuthStatus("none");
  }, [config]);

  const refresh = useCallback(async () => {
    if (authStatus !== "ready") return;
    await load();
  }, [authStatus, load]);

  const clearError = useCallback(() => setError(null), []);

  const pushChanges = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !hydratedRef.current) return;
    const snapshot = tasksRef.current;
    const dirty = snapshot.filter(
      (task) =>
        task.iid != null && lastSyncedRef.current.get(task.iid) !== taskSignature(task),
    );
    if (!dirty.length) return;

    setSyncing(true);
    let failure: string | null = null;
    for (const task of dirty) {
      try {
        await ensureLabelsForTask(task);
        const signature = taskSignature(task);
        const updated = await api.updateIssue(
          task.iid as number,
          taskToIssuePayload(task, membersRef.current, task.issueState, false),
        );
        lastSyncedRef.current.set(task.iid as number, signature);
        setTasks((previous) =>
          previous.map((item) =>
            item.id === task.id
              ? { ...item, issueState: updated.state, updatedAt: updated.updated_at }
              : item,
          ),
        );
      } catch (caught) {
        failure = errorText(caught);
        if (caught instanceof AuthRequiredError) {
          clearTokens();
          setAuthStatus("none");
        }
        break;
      }
    }
    setSyncing(false);
    if (failure) setError(failure);
  }, [ensureLabelsForTask]);

  useEffect(() => {
    if (authStatus !== "ready" || !hydratedRef.current) return;
    const dirty = tasks.some(
      (task) =>
        task.iid != null && lastSyncedRef.current.get(task.iid) !== taskSignature(task),
    );
    if (!dirty) return;
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void pushChanges();
    }, 500);
    return () => window.clearTimeout(syncTimerRef.current);
  }, [tasks, authStatus, pushChanges]);

  const createTask = useCallback(
    (draft: Partial<Task>): Task => {
      const now = new Date().toISOString();
      const status = draft.status ?? "todo";
      const maxOrder = tasksRef.current
        .filter((task) => task.status === status)
        .reduce((max, task) => Math.max(max, task.order), -1);
      const optimistic: Task = {
        id: `local-${uid()}`,
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
      setTasks((previous) => [...previous, optimistic]);

      void (async () => {
        const api = apiRef.current;
        if (!api) return;
        try {
          await ensureLabelsForTask(optimistic);
          const created = await api.createIssue(
            taskToIssuePayload(optimistic, membersRef.current, undefined, true),
          );
          const mapped = issueToTask(created);
          lastSyncedRef.current.set(mapped.iid as number, taskSignature(mapped));
          if (deletedTempRef.current.has(optimistic.id)) {
            deletedTempRef.current.delete(optimistic.id);
            await api.deleteIssue(mapped.iid as number);
            lastSyncedRef.current.delete(mapped.iid as number);
            return;
          }
          setTasks((previous) =>
            previous.map((task) => (task.id === optimistic.id ? mapped : task)),
          );
        } catch (caught) {
          setTasks((previous) => previous.filter((task) => task.id !== optimistic.id));
          setError(errorText(caught));
          if (caught instanceof AuthRequiredError) {
            clearTokens();
            setAuthStatus("none");
          }
        }
      })();

      return optimistic;
    },
    [ensureLabelsForTask],
  );

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === id
          ? { ...task, ...patch, updatedAt: new Date().toISOString() }
          : task,
      ),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    const task = tasksRef.current.find((item) => item.id === id);
    setTasks((previous) => previous.filter((item) => item.id !== id));
    if (!task?.iid) {
      deletedTempRef.current.add(id);
      return;
    }
    void (async () => {
      try {
        await apiRef.current?.deleteIssue(task.iid as number);
        lastSyncedRef.current.delete(task.iid as number);
      } catch (caught) {
        setError(errorText(caught));
        setTasks((previous) =>
          previous.some((item) => item.id === id) ? previous : [...previous, task],
        );
      }
    })();
  }, []);

  const moveTask = useCallback((id: string, status: Status, index?: number) => {
    setTasks((previous) => {
      const task = previous.find((item) => item.id === id);
      if (!task) return previous;
      const target = previous
        .filter((item) => item.status === status && item.id !== id)
        .sort((a, b) => a.order - b.order);
      const at =
        index === undefined ? target.length : Math.min(Math.max(index, 0), target.length);
      const ordered = [...target.slice(0, at), { ...task, status }, ...target.slice(at)];
      const orderMap = new Map(ordered.map((item, position) => [item.id, position]));
      return previous.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status,
            order: orderMap.get(id) ?? 0,
            updatedAt: new Date().toISOString(),
          };
        }
        if (item.status === status) {
          return orderMap.has(item.id) ? { ...item, order: orderMap.get(item.id) as number } : item;
        }
        return item;
      });
    });
  }, []);

  const reorderTask = useCallback((id: string, overId: string) => {
    setTasks((previous) => {
      const moving = previous.find((item) => item.id === id);
      const over = previous.find((item) => item.id === overId);
      if (!moving || !over || moving.status !== over.status) return previous;
      const list = previous
        .filter((item) => item.status === moving.status)
        .sort((a, b) => a.order - b.order);
      const from = list.findIndex((item) => item.id === id);
      const to = list.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0 || from === to) return previous;
      const next = [...list];
      next.splice(to, 0, next.splice(from, 1)[0]);
      const orderMap = new Map(next.map((item, position) => [item.id, position]));
      return previous.map((item) =>
        item.status === moving.status && orderMap.has(item.id)
          ? { ...item, order: orderMap.get(item.id) as number }
          : item,
      );
    });
  }, []);

  const importTasks = useCallback(
    async (incoming: Task[]): Promise<number> => {
      const api = apiRef.current;
      if (!api || !incoming.length) return 0;
      setSyncing(true);
      setError(null);
      let imported = 0;
      try {
        for (const task of incoming) {
          await ensureLabelsForTask(task);
          const created = await api.createIssue(
            taskToIssuePayload(task, membersRef.current, undefined, true),
          );
          const mapped = issueToTask(created);
          lastSyncedRef.current.set(mapped.iid as number, taskSignature(mapped));
          setTasks((previous) => [...previous, mapped]);
          imported += 1;
        }
      } catch (caught) {
        setError(errorText(caught));
        if (caught instanceof AuthRequiredError) {
          clearTokens();
          setAuthStatus("none");
        }
      } finally {
        setSyncing(false);
      }
      return imported;
    },
    [ensureLabelsForTask],
  );

  const importLocalTasks = useCallback(async (): Promise<number> => {
    try {
      const raw = localStorage.getItem(LOCAL_TASKS_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return 0;
      const incoming: Task[] = parsed
        .filter(
          (item) =>
            item &&
            typeof item.title === "string" &&
            ["todo", "doing", "done"].includes(item.status),
        )
        .map((item, index) => ({
          id: `import-${index}`,
          title: item.title,
          description: typeof item.description === "string" ? item.description : "",
          status: item.status,
          priority: ["P0", "P1", "P2", "P3"].includes(item.priority) ? item.priority : "P2",
          assignee: typeof item.assignee === "string" ? item.assignee : "",
          tags: Array.isArray(item.tags)
            ? item.tags.filter((tag: unknown) => typeof tag === "string")
            : [],
          startDate: typeof item.startDate === "string" ? item.startDate : null,
          dueDate: typeof item.dueDate === "string" ? item.dueDate : null,
          estimate: typeof item.estimate === "number" ? item.estimate : null,
          order: typeof item.order === "number" ? item.order : index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      return await importTasks(incoming);
    } catch {
      return 0;
    }
  }, [importTasks]);

  const seedDemoTasks = useCallback(async (): Promise<number> => {
    return importTasks(seedTasks.map((task) => ({ ...task })));
  }, [importTasks]);

  const replaceAll = useCallback(
    (incoming: Task[]) => {
      void importTasks(incoming);
    },
    [importTasks],
  );

  const resetSeed = useCallback(() => {
    /* Remote mode does not overwrite server data from the header menu. */
  }, []);

  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.assignee).filter(Boolean))).sort(),
    [tasks],
  );

  const tags = useMemo(
    () => Array.from(new Set(tasks.flatMap((task) => task.tags))).sort(),
    [tasks],
  );

  return {
    mode: "gitlab",
    authStatus,
    user,
    syncing,
    error,
    login,
    logout,
    refresh,
    clearError,
    importLocalTasks,
    seedDemoTasks,
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

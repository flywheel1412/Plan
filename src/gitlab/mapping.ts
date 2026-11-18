import type { Priority, Status, Task } from "../types";
import { PRIORITY_ORDER } from "../types";
import type { GitLabIssue, GitLabMember } from "./api";

export const STATUS_PREFIX = "status::";
export const PRIORITY_PREFIX = "priority::";
export const TAG_PREFIX = "tag::";

export const STATUS_LABELS: Record<Status, string> = {
  todo: "status::todo",
  doing: "status::doing",
  done: "status::done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "priority::P0",
  P1: "priority::P1",
  P2: "priority::P2",
  P3: "priority::P3",
};

export const BASE_LABELS: Array<{ name: string; color: string }> = [
  { name: STATUS_LABELS.todo, color: "#64748b" },
  { name: STATUS_LABELS.doing, color: "#6366f1" },
  { name: STATUS_LABELS.done, color: "#10b981" },
  { name: PRIORITY_LABELS.P0, color: "#e11d48" },
  { name: PRIORITY_LABELS.P1, color: "#d97706" },
  { name: PRIORITY_LABELS.P2, color: "#0284c7" },
  { name: PRIORITY_LABELS.P3, color: "#64748b" },
];

const TAG_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];

export function tagLabel(tag: string): string {
  return `${TAG_PREFIX}${tag}`;
}

export function tagColor(tag: string): string {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export function labelsForTask(task: Task): string[] {
  return [
    STATUS_LABELS[task.status],
    PRIORITY_LABELS[task.priority],
    ...Array.from(new Set(task.tags.filter(Boolean))).map(tagLabel),
  ];
}

export interface TaskMeta {
  startDate: string | null;
  estimate: number | null;
  order: number;
  assigneeName?: string;
}

const META_RE = /<!--\s*plan-kanban:v1:([A-Za-z0-9_-]+)\s*-->/;

function encodeMeta(meta: TaskMeta): string {
  const bytes = new TextEncoder().encode(JSON.stringify(meta));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeMeta(value: string): TaskMeta | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TaskMeta;
  } catch {
    return null;
  }
}

export function parseDescription(raw: string | null): {
  description: string;
  meta: Partial<TaskMeta>;
} {
  const source = raw ?? "";
  const match = source.match(META_RE);
  const meta = match ? decodeMeta(match[1]) : null;
  return {
    description: source.replace(META_RE, "").trim(),
    meta: meta ?? {},
  };
}

export function buildDescription(description: string, meta: TaskMeta): string {
  const clean = description.trim();
  const marker = `<!-- plan-kanban:v1:${encodeMeta(meta)} -->`;
  return clean ? `${clean}\n\n${marker}` : marker;
}

function statusFromLabels(labels: string[]): Status | null {
  if (labels.includes(STATUS_LABELS.doing)) return "doing";
  if (labels.includes(STATUS_LABELS.done)) return "done";
  if (labels.includes(STATUS_LABELS.todo)) return "todo";
  return null;
}

function priorityFromLabels(labels: string[]): Priority {
  for (const priority of PRIORITY_ORDER) {
    if (labels.includes(PRIORITY_LABELS[priority])) return priority;
  }
  return "P2";
}

export function issueToTask(issue: GitLabIssue): Task {
  const { description, meta } = parseDescription(issue.description);
  const labels = issue.labels ?? [];
  const status = statusFromLabels(labels) ?? (issue.state === "closed" ? "done" : "todo");
  const tags = labels
    .filter((label) => label.startsWith(TAG_PREFIX))
    .map((label) => label.slice(TAG_PREFIX.length))
    .filter(Boolean);
  const assignee =
    issue.assignees?.[0]?.name ||
    issue.assignees?.[0]?.username ||
    (typeof meta.assigneeName === "string" ? meta.assigneeName : "");

  return {
    id: `issue-${issue.iid}`,
    iid: issue.iid,
    issueState: issue.state,
    title: issue.title,
    description,
    status,
    priority: priorityFromLabels(labels),
    assignee,
    tags,
    startDate: typeof meta.startDate === "string" ? meta.startDate : null,
    dueDate: issue.due_date ?? null,
    estimate: typeof meta.estimate === "number" ? meta.estimate : null,
    order: typeof meta.order === "number" ? meta.order : issue.iid,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

export function taskToIssuePayload(
  task: Task,
  members: GitLabMember[],
  currentState: "opened" | "closed" | undefined,
  isCreate = false,
): Record<string, unknown> {
  const member = members.find(
    (item) => item.name === task.assignee || item.username === task.assignee,
  );
  const meta: TaskMeta = {
    startDate: task.startDate,
    estimate: task.estimate,
    order: task.order,
    assigneeName: task.assignee || undefined,
  };
  const payload: Record<string, unknown> = {
    title: task.title,
    description: buildDescription(task.description, meta),
    labels: labelsForTask(task).join(","),
    assignee_ids: member ? [member.id] : [],
  };
  if (task.dueDate || !isCreate) payload.due_date = task.dueDate ?? "";

  if (task.status === "done" && currentState !== "closed") {
    payload.state_event = "close";
  } else if (task.status !== "done" && currentState === "closed") {
    payload.state_event = "reopen";
  }
  return payload;
}

export function taskSignature(task: Task): string {
  return JSON.stringify([
    task.title,
    task.description,
    task.status,
    task.priority,
    task.assignee,
    task.tags,
    task.startDate,
    task.dueDate,
    task.estimate,
    task.order,
  ]);
}

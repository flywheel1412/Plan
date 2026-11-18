import { CalendarDays, Clock, Flag, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../types";
import { fmt, isOverdue, relativeDue } from "../utils/date";
import { avatarColor, cx, initialOf } from "../utils/ui";
import { MarkdownView } from "./Markdown";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  overlay?: boolean;
}

export function TaskCardView({ task, onEdit, overlay = false }: TaskCardProps) {
  const done = task.status === "done";
  const overdue = isOverdue(task.dueDate, done);
  const due = done ? { text: "", tone: "none" as const } : relativeDue(task.dueDate);

  return (
    <article
      className={cx(
        "task-card polished-task",
        done && "is-done",
        overdue && "is-overdue",
        overlay && "is-overlay",
      )}
      onClick={onEdit ? () => onEdit(task) : undefined}
    >
      <div className="task-top">
        <span className={cx("priority-pill", `priority-${task.priority}`)}>
          <Flag size={10} aria-hidden="true" /> {task.priority}
        </span>
        {task.iid != null && <span className="task-iid">#{task.iid}</span>}
        {due.tone !== "none" && (
          <span className={cx("due-pill", due.tone)}>{due.text}</span>
        )}
        <span className="drag-grip" aria-hidden="true">
          <GripVertical size={15} />
        </span>
      </div>

      <h4 className="task-title">{task.title}</h4>

      {task.description && (
        <MarkdownView
          content={task.description}
          className="task-desc markdown-desc"
          compact
        />
      )}

      {task.tags.length > 0 && (
        <div className="task-tags">
          {task.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="task-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <footer className="task-footer">
        <span className="assignee">
          <span
            className="avatar sm"
            style={{ background: avatarColor(task.assignee) }}
            aria-hidden="true"
          >
            {initialOf(task.assignee)}
          </span>
          <span className={task.assignee ? "assignee-name" : "assignee-name empty"}>
            {task.assignee || "未分配"}
          </span>
        </span>

        <span className="task-meta">
          {task.dueDate && (
            <span className={cx("meta-item", overdue && "is-overdue")}>
              <CalendarDays size={13} />
              {fmt(task.dueDate)}
            </span>
          )}
          {task.estimate != null && (
            <span className="meta-item">
              <Clock size={13} />
              {task.estimate}h
            </span>
          )}
        </span>
      </footer>
    </article>
  );
}

interface SortableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export function SortableTaskCard({ task, onEdit }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      className={cx("task-card-wrap", isDragging && "is-placeholder")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`任务：${task.title}`}
      {...attributes}
      {...listeners}
    >
      <TaskCardView task={task} onEdit={onEdit} />
    </div>
  );
}

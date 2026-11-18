import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ListFilter, Trash2, X } from "lucide-react";
import type { Priority, Status, Task } from "../types";
import { COLUMNS, PRIORITY_META, PRIORITY_ORDER } from "../types";
import { cx } from "../utils/ui";
import { MarkdownView } from "./Markdown";

interface TaskModalProps {
  open: boolean;
  task: Task | null;
  defaults: { status?: Status; dueDate?: string } | null;
  assignees: string[];
  allTags: string[];
  onClose: () => void;
  onSave: (id: string | null, draft: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskModal({
  open,
  task,
  defaults,
  assignees,
  allTags,
  onClose,
  onSave,
  onDelete,
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [priority, setPriority] = useState<Priority>("P2");
  const [assignee, setAssignee] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [error, setError] = useState("");
  const [descriptionTab, setDescriptionTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (!open) return;
    setError("");
    setTagDraft("");
    setDescriptionTab("edit");
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setAssignee(task.assignee);
      setTags(task.tags);
      setStartDate(task.startDate ?? "");
      setDueDate(task.dueDate ?? "");
      setEstimate(task.estimate != null ? String(task.estimate) : "");
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaults?.status ?? "todo");
      setPriority("P2");
      setAssignee("");
      setTags([]);
      setStartDate("");
      setDueDate(defaults?.dueDate ?? "");
      setEstimate("");
    }
  }, [open, task, defaults]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const suggestions = useMemo(
    () => allTags.filter((tag) => !tags.includes(tag)).slice(0, 8),
    [allTags, tags],
  );

  const addTag = (raw: string) => {
    const parts = raw
      .split(/[,，、]/)
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean);
    if (!parts.length) return;
    setTags((prev) => Array.from(new Set([...prev, ...parts])));
    setTagDraft("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("请填写任务标题");
      return;
    }
    if (startDate && dueDate && startDate > dueDate) {
      setError("截止日期不能早于开始日期");
      return;
    }
    const parsedEstimate = estimate.trim() === "" ? null : Number(estimate);
    if (parsedEstimate != null && (Number.isNaN(parsedEstimate) || parsedEstimate < 0)) {
      setError("预估工时需要是大于等于 0 的数字");
      return;
    }
    onSave(task?.id ?? null, {
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      assignee: assignee.trim(),
      tags,
      startDate: startDate || null,
      dueDate: dueDate || null,
      estimate: parsedEstimate,
    });
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <form onSubmit={handleSubmit}>
          <header className="modal-head">
            <div>
              <span className="modal-kicker">{task ? "编辑任务" : "新建任务"}</span>
              <h2 id="task-modal-title">{task ? "调整排期与信息" : "创建一个排期任务"}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
              <X size={18} />
            </button>
          </header>

          <div className="modal-body">
            <label className="field">
              <span className="field-label">任务标题</span>
              <input
                className="input title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：完成 Q4 路线图评审"
                autoFocus
                maxLength={120}
              />
            </label>

            <div className="field">
              <div className="field-head">
                <label className="field-label" htmlFor="task-description">
                  任务描述
                </label>
                <div className="desc-tabs" role="tablist" aria-label="描述编辑模式">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={descriptionTab === "edit"}
                    className={cx("desc-tab", descriptionTab === "edit" && "active")}
                    onClick={() => setDescriptionTab("edit")}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={descriptionTab === "preview"}
                    className={cx("desc-tab", descriptionTab === "preview" && "active")}
                    onClick={() => setDescriptionTab("preview")}
                  >
                    预览
                  </button>
                </div>
              </div>
              {descriptionTab === "edit" ? (
                <>
                  <textarea
                    id="task-description"
                    className="input textarea"
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="支持 Markdown：**粗体**、- 列表、`代码`、[链接](https://example.com)…"
                  />
                  <span className="field-hint">
                    支持 Markdown 格式；同步到 GitLab Issue 后会按 Markdown 渲染。
                  </span>
                </>
              ) : (
                <div className="markdown-preview">
                  {description.trim() ? (
                    <MarkdownView content={description} />
                  ) : (
                    <span className="preview-empty">暂无描述内容</span>
                  )}
                </div>
              )}
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">状态</span>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">预估工时</span>
                <div className="input-with-unit">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={0.5}
                    value={estimate}
                    onChange={(e) => setEstimate(e.target.value)}
                    placeholder="例如 8"
                  />
                  <span className="unit">小时</span>
                </div>
              </label>
            </div>

            <div className="field">
              <span className="field-label">优先级</span>
              <div className="priority-group" role="group" aria-label="优先级">
                {PRIORITY_ORDER.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={cx(
                      "priority-option",
                      `priority-${p}`,
                      priority === p && "active",
                    )}
                    onClick={() => setPriority(p)}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid three">
              <label className="field">
                <span className="field-label">负责人</span>
                <input
                  className="input"
                  list="assignee-options"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="输入或选择"
                />
                <datalist id="assignee-options">
                  {assignees.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span className="field-label">开始日期</span>
                <input
                  className="input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>

              <label className="field">
                <span className="field-label">截止日期</span>
                <input
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            </div>

            <div className="field">
              <span className="field-label">标签</span>
              <div className="tag-editor">
                {tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      aria-label={`移除标签 ${tag}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === "，") {
                      e.preventDefault();
                      addTag(tagDraft);
                    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                      setTags((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => addTag(tagDraft)}
                  placeholder={tags.length ? "继续添加…" : "输入标签后回车，例如：前端"}
                />
              </div>
              {suggestions.length > 0 && (
                <div className="tag-suggests">
                  <ListFilter size={13} />
                  {suggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="tag-suggest"
                      onClick={() => setTags((prev) => [...prev, tag])}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="form-error">{error}</p>}
          </div>

          <footer className="modal-foot">
            {task && (
              <button
                type="button"
                className="btn btn-ghost danger-text"
                onClick={() => {
                  if (window.confirm("确定删除这个任务吗？该操作不可撤销。")) onDelete(task.id);
                }}
              >
                <Trash2 size={16} />
                删除任务
              </button>
            )}
            <div className="modal-spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {task ? "保存修改" : "创建任务"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

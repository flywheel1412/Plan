import { useId, useMemo, useState } from "react";
import { useLocalDay } from "../hooks/useLocalDay";
import { Check, CheckCheck, ChevronDown } from "lucide-react";
import { PRIORITY_ORDER, type Task } from "../types";
import { addDays } from "date-fns";
import { fmt, fromISO, toISO } from "../utils/date";
import "./today-agenda.css";

interface TodayAgendaProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  /** Set only dueDate; startDate is unchanged. */
  onSchedule?: (task: Task, date: string) => void;
}

const sections = [
  { key: "overdue", title: "逾期" },
  { key: "today", title: "今日安排" },
  { key: "unscheduled", title: "未排期" },
  { key: "next", title: "接下来" },
] as const;
type Group = (typeof sections)[number]["key"];

function groupFor({ startDate: start, dueDate: end }: Task, today: string): Group {
  if (end && end < today) return "overdue";
  if (start === today || end === today || (start && end && start < today && today < end)) return "today";
  return start || end ? "next" : "unscheduled";
}

function scheduleLabel({ startDate: start, dueDate: end }: Task, today: string) {
  // Older JSON imports may contain non-ISO dates. Keep the row editable.
  if ([start, end].some(value => value && !Number.isFinite(fromISO(value).getTime()))) return "日期待检查";
  const short = (iso: string) => iso === today ? "今天" : fmt(iso, iso.slice(0, 4) === today.slice(0, 4) ? "M月d日" : "yyyy年M月d日");
  if (start && end) {
    if (start === end) return short(start);
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    const last = sameMonth && start !== today && end !== today ? fmt(end, "d日") : short(end);
    return `${short(start)} 至 ${last}`;
  }
  if (start) return `${short(start)}开始`;
  if (end) return `${short(end)}截止`;
  return null;
}

export function TodayAgenda({ tasks, onEdit, onComplete, onSchedule }: TodayAgendaProps) {
  const id = useId();
  const today = useLocalDay();
  const [expanded, setExpanded] = useState<Partial<Record<Group, boolean>>>({});
  const groups = useMemo(() => {
    const lists: Record<Group, Task[]> = { overdue: [], today: [], unscheduled: [], next: [] };
    for (const task of tasks) {
      if (task.status !== "done") lists[groupFor(task, today)].push(task);
    }
    for (const { key } of sections) {
      const sortDate = (t: Task) => (key === "next" ? t.startDate ?? t.dueDate : t.dueDate ?? t.startDate) ?? "";
      lists[key].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
        || sortDate(a).localeCompare(sortDate(b)) || a.order - b.order || a.id.localeCompare(b.id));
    }
    return lists;
  }, [tasks, today]);
  const first = sections.find(s => groups[s.key].length)?.key;

  return (
    <section className="today-agenda" aria-label="任务日程">
      {!first ? (
        <div className="ta-empty"><CheckCheck aria-hidden="true" size={26} /><p>当前没有未完成任务</p></div>
      ) : sections.map(({ key, title }) => {
        const list = groups[key];
        const open = expanded[key] ?? (key === "today" || key === "overdue" || key === first);
        if (!list.length && key !== "today") return null;
        return (
          <div className={`ta-group ta-${key}`} key={key}>
            <h2><button className="ta-toggle" type="button" aria-expanded={open}
              onClick={() => setExpanded(previous => ({ ...previous, [key]: !open }))}>
              {title}<span className="ta-count">{list.length}</span>
              <ChevronDown className="ta-chevron" size={15} aria-hidden="true" />
            </button></h2>
            {open && (list.length ? <ul>{list.map(task => (
              <li key={task.id}>
                <button className="ta-complete" type="button" onClick={() => onComplete(task)}
                  aria-label={`标记完成：${task.title}`} title="标记完成"><span aria-hidden="true"><Check size={14} /></span></button>
                <button className="ta-edit" type="button" onClick={() => onEdit(task)} aria-label={`编辑：${task.title}`} aria-describedby={`${id}-${encodeURIComponent(task.id)}`}>
                  <strong>{task.title}</strong>
                  <span className="ta-meta" id={`${id}-${encodeURIComponent(task.id)}`}><span className="ta-priority" data-priority={task.priority}>{task.priority}</span>
                    {(task.startDate || task.dueDate) && <span>{scheduleLabel(task, today)}</span>}
                    {task.estimate != null && <span>预计 {task.estimate}h</span>}</span>
                </button>
                {onSchedule && (key === "unscheduled" || key === "overdue") && (
                  <button className="ta-schedule" type="button"
                    title="只修改截止日期，不改开始日期"
                    aria-label={`${task.title}：将截止日期设为${key === "overdue" ? "明天" : "今天"}`}
                    onClick={() => onSchedule(task, key === "overdue" ? toISO(addDays(fromISO(today), 1)) : today)}>
                    {key === "overdue" ? "截止延至明天" : "今天截止"}
                  </button>
                )}
              </li>
            ))}</ul> : <p className="ta-none">没有排在今天的任务</p>)}
          </div>
        );
      })}
    </section>
  );
}

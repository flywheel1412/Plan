import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CalendarDays, Check, CheckCheck, ChevronDown, Clock3, Inbox, ListTodo, MoveRight } from "lucide-react";
import { PRIORITY_ORDER, type Task } from "../types";
import { addDays } from "date-fns";
import { fmtLong, fromISO, toISO, todayISO } from "../utils/date";
import "./today-agenda.css";

interface TodayAgendaProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
  /** Set only dueDate; startDate is unchanged. */
  onSchedule?: (task: Task, date: string) => void;
}

const sections = [
  { key: "overdue", title: "逾期", icon: AlarmClock },
  { key: "today", title: "今日安排", icon: CalendarDays },
  { key: "unscheduled", title: "未排期", icon: Inbox },
  { key: "next", title: "接下来", icon: MoveRight },
] as const;
type Group = (typeof sections)[number]["key"];

function groupFor({ startDate: start, dueDate: end }: Task, today: string): Group {
  if (end && end < today) return "overdue";
  if (start === today || end === today || (start && end && start < today && today < end)) return "today";
  return start || end ? "next" : "unscheduled";
}

function scheduleLabel({ startDate: start, dueDate: end }: Task) {
  if (start && end) return start === end ? `${start} 当日` : `${start} 至 ${end}`;
  if (start) return `${start} 开始`;
  if (end) return `${end} 截止`;
  return "未设日期";
}

// Refresh locally at midnight; a backgrounded tab also checks when it regains focus.
function useLocalDay() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setToday(todayISO());
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    refresh();
    const timer = window.setTimeout(refresh, midnight.getTime() - Date.now() + 10);
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [today]);
  return today;
}

export function TodayAgenda({ tasks, onEdit, onComplete, onSchedule }: TodayAgendaProps) {
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
      <header className="ta-heading">
        <div><ListTodo size={20} aria-hidden="true" /><h2>任务日程</h2></div>
        <time dateTime={today}>{fmtLong(today)}</time>
      </header>
      {!first ? (
        <div className="ta-empty"><CheckCheck aria-hidden="true" size={26} /><p>当前没有未完成任务</p></div>
      ) : sections.map(({ key, title, icon: Icon }) => {
        const list = groups[key];
        const open = expanded[key] ?? (key === "today" || key === "overdue" || key === first);
        if (!list.length && key !== "today") return null;
        return (
          <div className={`ta-group ta-${key}`} key={key}>
            <h3><button className="ta-toggle" type="button" aria-expanded={open}
              onClick={() => setExpanded(previous => ({ ...previous, [key]: !open }))}>
              <Icon size={16} aria-hidden="true" />{title}<span className="ta-count">{list.length}</span>
              <ChevronDown className="ta-chevron" size={15} aria-hidden="true" />
            </button></h3>
            {open && (list.length ? <ul>{list.map(task => (
              <li key={task.id}>
                <button className="ta-edit" type="button" onClick={() => onEdit(task)} aria-label={`编辑：${task.title}`}>
                  <span className="ta-titleline"><span className="ta-priority" data-priority={task.priority}>{task.priority}</span>
                    <strong>{task.title}</strong></span>
                  <span className="ta-meta"><span><CalendarDays size={13} aria-hidden="true" />{scheduleLabel(task)}</span>
                    {task.estimate != null && <span><Clock3 size={13} aria-hidden="true" />预计 {task.estimate}h</span>}</span>
                </button>
                {onSchedule && (key === "unscheduled" || key === "overdue") && (
                  <button className="ta-schedule" type="button"
                    title="只修改截止日期，不改开始日期"
                    aria-label={`${task.title}：将截止日期设为${key === "overdue" ? "明天" : "今天"}`}
                    onClick={() => onSchedule(task, key === "overdue" ? toISO(addDays(fromISO(today), 1)) : today)}>
                    {key === "overdue" ? "截止延至明天" : "今天截止"}
                  </button>
                )}
                <button className="ta-complete" type="button" onClick={() => onComplete(task)}
                  aria-label={`标记完成：${task.title}`} title="标记完成"><Check size={16} aria-hidden="true" /></button>
              </li>
            ))}</ul> : <p className="ta-none">没有排在今天的任务</p>)}
          </div>
        );
      })}
    </section>
  );
}

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  format,
  getDaysInMonth,
  isSameMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "../types";
import { PRIORITY_META, PRIORITY_ORDER } from "../types";
import { isOverdue, isToday, toISO, WEEKDAYS } from "../utils/date";
import { cx } from "../utils/ui";

interface CalendarViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onCreate: (date: string) => void;
}

export function CalendarView({ tasks, onEdit, onCreate }: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = (first.getDay() + 6) % 7;
    const total = Math.ceil((offset + getDaysInMonth(first)) / 7) * 7;
    const start = addDays(first, -offset);
    return Array.from({ length: total }, (_, i) => addDays(start, i));
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority);
        const pb = PRIORITY_ORDER.indexOf(b.priority);
        if (pa !== pb) return pa - pb;
        return a.order - b.order;
      }),
    );
    return map;
  }, [tasks]);

  const monthDue = useMemo(
    () =>
      tasks.filter(
        (task) => task.dueDate && isSameMonth(parseISO(task.dueDate), cursor),
      ).length,
    [tasks, cursor],
  );

  return (
    <section className="calendar-card">
      <header className="calendar-head">
        <div className="calendar-title">
          <CalendarDays size={19} />
          <h2>{format(cursor, "yyyy 年 M 月", { locale: zhCN })}</h2>
          <span className="calendar-count">本月截止 {monthDue} 个任务</span>
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            className="icon-btn bordered"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="上个月"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            今天
          </button>
          <button
            type="button"
            className="icon-btn bordered"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="下个月"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </header>

      <div className="calendar-legend">
        {PRIORITY_ORDER.map((p) => (
          <span key={p} className="legend-item">
            <i style={{ background: PRIORITY_META[p].color }} />
            {PRIORITY_META[p].label}
          </span>
        ))}
        <span className="legend-item">
          <i style={{ background: "#10b981" }} />
          已完成
        </span>
        <span className="legend-hint">点击日期可快速新建任务</span>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((day) => (
          <div key={day} className="calendar-weekday">
            周{day}
          </div>
        ))}

        {days.map((day) => {
          const iso = toISO(day);
          const list = byDate.get(iso) ?? [];
          const outside = !isSameMonth(day, cursor);
          const weekend = [0, 6].includes(day.getDay());
          return (
            <div
              key={iso}
              className={cx(
                "cal-day",
                outside && "outside",
                isToday(iso) && "today",
                weekend && "weekend",
              )}
              onClick={() => onCreate(iso)}
              role="button"
              tabIndex={-1}
              title={`在 ${format(day, "M月d日", { locale: zhCN })} 新建任务`}
            >
              <div className="cal-day-head">
                <span className="cal-date">{format(day, "d")}</span>
                {isToday(iso) && <span className="cal-today-tag">今天</span>}
                {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
              </div>
              <div className="cal-items">
                {list.slice(0, 3).map((task) => {
                  const done = task.status === "done";
                  const overdue = isOverdue(task.dueDate, done);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={cx("cal-item", done && "done", overdue && "overdue")}
                      title={`${task.title}${task.assignee ? ` · ${task.assignee}` : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(task);
                      }}
                    >
                      <span
                        className={cx(
                          "cal-dot",
                          done ? "done" : `priority-${task.priority}`,
                        )}
                      />
                      <span className="cal-item-title">{task.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfWeek,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarRange, LocateFixed } from "lucide-react";
import type { Task } from "../types";
import { PRIORITY_ORDER } from "../types";
import { isOverdue, toISO, WEEKDAYS } from "../utils/date";
import { avatarColor, cx, initialOf } from "../utils/ui";

const DAY_W = 30;
const LEFT_W = 264;

interface TimelineViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
}

const STATUS_COLOR: Record<Task["status"], string> = {
  todo: "#94a3b8",
  doing: "#6366f1",
  done: "#10b981",
};

export function TimelineView({ tasks, onEdit }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scheduled = useMemo(
    () => tasks.filter((task) => task.startDate || task.dueDate),
    [tasks],
  );

  const domain = useMemo(() => {
    const dates = scheduled
      .flatMap((task) => [task.startDate, task.dueDate])
      .filter(Boolean)
      .map((d) => parseISO(d as string));
    const today = new Date();
    let start = dates.length ? minDate(dates) : addDays(today, -7);
    let end = dates.length ? maxDate(dates) : addDays(today, 21);
    if (today < start) start = today;
    if (today > end) end = today;
    const gridStart = startOfWeek(start, { weekStartsOn: 1 });
    let gridEnd = addDays(startOfWeek(end, { weekStartsOn: 1 }), 6);
    if (differenceInCalendarDays(gridEnd, gridStart) < 27) {
      gridEnd = addDays(gridStart, 27);
    }
    const total = differenceInCalendarDays(gridEnd, gridStart) + 1;
    return {
      start: gridStart,
      end: gridEnd,
      total,
      startIso: toISO(gridStart),
      days: Array.from({ length: total }, (_, i) => addDays(gridStart, i)),
    };
  }, [scheduled]);

  const months = useMemo(() => {
    const segments: Array<{ label: string; span: number }> = [];
    domain.days.forEach((day) => {
      const label = format(day, "yyyy年M月", { locale: zhCN });
      const last = segments[segments.length - 1];
      if (last && last.label === label) last.span += 1;
      else segments.push({ label, span: 1 });
    });
    return segments;
  }, [domain.days]);

  const rows = useMemo(
    () =>
      [...scheduled].sort((a, b) => {
        const aStart = a.startDate ?? a.dueDate ?? "";
        const bStart = b.startDate ?? b.dueDate ?? "";
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        const pa = PRIORITY_ORDER.indexOf(a.priority);
        const pb = PRIORITY_ORDER.indexOf(b.priority);
        return pa - pb;
      }),
    [scheduled],
  );

  const todayOffset = differenceInCalendarDays(new Date(), domain.start);

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (!el) return;
    const target = LEFT_W + todayOffset * DAY_W - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, LEFT_W + todayOffset * DAY_W - el.clientWidth / 2);
    // Only reposition when the visible range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.startIso]);

  const chartWidth = domain.total * DAY_W;

  return (
    <section className="timeline-card">
      <header className="timeline-head-bar">
        <div className="timeline-title">
          <CalendarRange size={19} />
          <h2>排期时间线</h2>
          <span className="timeline-range">
            {format(domain.start, "M月d日", { locale: zhCN })} –{" "}
            {format(domain.end, "M月d日", { locale: zhCN })} · {domain.total} 天
          </span>
        </div>
        <div className="timeline-actions">
          <span className="timeline-hint">点击任务条可编辑排期</span>
          <button type="button" className="btn btn-ghost" onClick={scrollToToday}>
            <LocateFixed size={15} />
            定位今天
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="empty-state">
          <CalendarRange size={30} />
          <p>还没有带日期的任务</p>
          <span>为任务补充开始或截止日期后，这里会显示甘特式排期。</span>
        </div>
      ) : (
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline" style={{ width: LEFT_W + chartWidth }}>
            <div className="tl-row tl-months-row">
              <div className="tl-left tl-corner">任务 / 负责人</div>
              <div className="tl-track tl-months" style={{ width: chartWidth }}>
                {months.map((segment, index) => (
                  <div
                    key={`${segment.label}-${index}`}
                    className="tl-month"
                    style={{ width: segment.span * DAY_W }}
                  >
                    {segment.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="tl-row tl-days-row">
              <div className="tl-left tl-corner-sub">
                共 {rows.length} 个排期任务
              </div>
              <div
                className="tl-track tl-days"
                style={{
                  width: chartWidth,
                  backgroundSize: `${DAY_W}px 100%`,
                }}
              >
                {domain.days.map((day) => {
                  const iso = toISO(day);
                  const isWeekend = [0, 6].includes(day.getDay());
                  const today = iso === toISO(new Date());
                  return (
                    <div
                      key={iso}
                      className={cx(
                        "tl-day",
                        isWeekend && "weekend",
                        today && "today",
                        day.getDay() === 1 && "monday",
                      )}
                      style={{ width: DAY_W }}
                      title={format(day, "yyyy年M月d日 EEE", { locale: zhCN })}
                    >
                      <span>{format(day, "d")}</span>
                      <small>{WEEKDAYS[(day.getDay() + 6) % 7]}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="tl-body">
              <div
                className="tl-today-line"
                style={{ left: LEFT_W + todayOffset * DAY_W + DAY_W / 2 }}
              >
                <span>今天</span>
              </div>

              {rows.map((task) => {
                const startRaw = parseISO(task.startDate ?? task.dueDate ?? "");
                const endRaw = parseISO(task.dueDate ?? task.startDate ?? "");
                const from = startRaw <= endRaw ? startRaw : endRaw;
                const to = startRaw <= endRaw ? endRaw : startRaw;
                const left = differenceInCalendarDays(from, domain.start) * DAY_W;
                const span = differenceInCalendarDays(to, from) + 1;
                const width = Math.max(DAY_W - 8, span * DAY_W - 8);
                const narrow = width < 90;
                const overdue = isOverdue(task.dueDate, task.status === "done");
                const label = `${task.title} · ${format(from, "M月d日", {
                  locale: zhCN,
                })} → ${format(to, "M月d日", { locale: zhCN })}`;

                return (
                  <div className="tl-row tl-task-row" key={task.id}>
                    <div className="tl-left tl-task-left">
                      <span
                        className="tl-status-dot"
                        style={{ background: STATUS_COLOR[task.status] }}
                      />
                      <span className="tl-task-title" title={task.title}>
                        {task.title}
                      </span>
                      {task.assignee ? (
                        <span className="tl-assignee">
                          <span
                            className="avatar xs"
                            style={{ background: avatarColor(task.assignee) }}
                          >
                            {initialOf(task.assignee)}
                          </span>
                          {task.assignee}
                        </span>
                      ) : (
                        <span className="tl-assignee empty">未分配</span>
                      )}
                    </div>
                    <div className="tl-track tl-bar-track" style={{ width: chartWidth }}>
                      <button
                        type="button"
                        className={cx(
                          "tl-bar",
                          `status-${task.status}`,
                          narrow && "is-narrow",
                          overdue && "is-overdue",
                        )}
                        style={{ left, width }}
                        title={label}
                        aria-label={label}
                        onClick={() => onEdit(task)}
                      >
                        {narrow ? (
                          <span className="tl-bar-dot" aria-hidden="true" />
                        ) : (
                          <span className="tl-bar-text">{task.title}</span>
                        )}
                        {overdue && !narrow && <span className="tl-bar-alert">逾期</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

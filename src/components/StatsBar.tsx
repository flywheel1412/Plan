import { CircleAlert, CircleDot, Layers3, PieChart } from "lucide-react";
import type { Task } from "../types";
import { isOverdue } from "../utils/date";
import "./stats-filters.css";

export function StatsBar({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  let doing = 0, done = 0, postponed = 0, overdue = 0, plannedHours = 0;
  for (const task of tasks) {
    if (task.status === "done") done++;
    else plannedHours += task.estimate ?? 0;
    if (task.status === "doing") doing++;
    if (task.status === "postponed") postponed++;
    if (isOverdue(task.dueDate, task.status === "done")) overdue++;
  }
  const todo = total - done - doing - postponed;
  const fraction = (count: number) => total ? count / total : 0;
  return (
    <section className="sf-metrics" aria-label="任务统计">
      <article className="sf-metric">
        <span className="sf-label"><Layers3 />任务总数</span>
        <div className="sf-number-row"><strong>{total}</strong>
          <span className="sf-distribution" aria-hidden="true" title={`待办 ${todo} · 进行中 ${doing} · 推迟 ${postponed} · 已完成 ${done}`}>
            <i style={{ width: `${100 * fraction(doing)}%` }} /><i style={{ width: `${100 * fraction(done)}%` }} /><i style={{ width: `${100 * fraction(postponed)}%`, background: "#b7791f" }} />
          </span>
        </div>
        <span className="sf-caption">待办 {todo} · 进行中 {doing} · 推迟 {postponed}</span>
      </article>
      <article className="sf-metric">
        <span className="sf-label"><CircleDot />进行中</span>
        <div className="sf-number-row sf-emphasis"><strong>{doing}</strong></div>
        <span className="sf-caption">剩余预估 {plannedHours.toLocaleString()} h</span>
      </article>
      <article className="sf-metric">
        <span className="sf-label"><PieChart />完成率</span>
        <div className="sf-number-row"><strong>{Math.round(100 * fraction(done))}<small>%</small></strong>
          <svg aria-hidden="true" className="sf-ring" viewBox="0 0 32 32" fill="none" strokeWidth="3.5">
            <circle cx="16" cy="16" r="12" stroke="var(--sf-track)" />
            <circle cx="16" cy="16" r="12" stroke="var(--sf-blue)" pathLength="100" strokeDasharray={`${100 * fraction(done)} 100`} transform="rotate(-90 16 16)" />
          </svg>
        </div>
        <span className="sf-caption">已完成 {done} / {total}</span>
      </article>
      <article className="sf-metric">
        <span className="sf-label"><CircleAlert />逾期风险</span>
        <div className="sf-number-row"><strong>{overdue}</strong></div>
        <span className="sf-caption">{overdue ? "请尽快处理逾期任务" : "当前没有逾期任务"}</span>
      </article>
    </section>
  );
}

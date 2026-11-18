import { AlertTriangle, CheckCircle2, ListTodo, Zap } from "lucide-react";
import type { Task } from "../types";
import { isOverdue } from "../utils/date";

interface StatsBarProps {
  tasks: Task[];
}

export function StatsBar({ tasks }: StatsBarProps) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const doing = tasks.filter((t) => t.status === "doing").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.status === "done")).length;
  const rate = total ? Math.round((done / total) * 100) : 0;
  const plannedHours = tasks
    .filter((t) => t.status !== "done")
    .reduce((sum, t) => sum + (t.estimate ?? 0), 0);

  return (
    <section className="stats" aria-label="任务统计">
      <article className="stat-card">
        <div className="stat-icon indigo">
          <ListTodo size={19} />
        </div>
        <div className="stat-body">
          <span className="stat-label">任务总数</span>
          <strong className="stat-value">{total}</strong>
          <span className="stat-sub">待办 {todo} · 进行中 {doing}</span>
        </div>
      </article>

      <article className="stat-card">
        <div className="stat-icon sky">
          <Zap size={19} />
        </div>
        <div className="stat-body">
          <span className="stat-label">进行中</span>
          <strong className="stat-value">{doing}</strong>
          <span className="stat-sub">剩余预估 {plannedHours}h</span>
        </div>
      </article>

      <article className="stat-card">
        <div
          className="stat-ring"
          style={{ ["--rate" as string]: `${rate * 3.6}deg` }}
          aria-hidden="true"
        >
          <span>{rate}%</span>
        </div>
        <div className="stat-body">
          <span className="stat-label">完成率</span>
          <strong className="stat-value">
            {done}
            <small> / {total}</small>
          </strong>
          <span className="stat-sub">
            <CheckCircle2 size={12} /> 已完成任务
          </span>
        </div>
      </article>

      <article className={overdue > 0 ? "stat-card stat-alert" : "stat-card"}>
        <div className={overdue > 0 ? "stat-icon rose" : "stat-icon slate"}>
          <AlertTriangle size={19} />
        </div>
        <div className="stat-body">
          <span className="stat-label">逾期风险</span>
          <strong className="stat-value">{overdue}</strong>
          <span className="stat-sub">
            {overdue > 0 ? "请尽快处理逾期任务" : "当前没有逾期任务"}
          </span>
        </div>
      </article>
    </section>
  );
}

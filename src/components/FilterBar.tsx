import { Search, SlidersHorizontal, X } from "lucide-react";
import { PRIORITY_ORDER, PRIORITY_META } from "../types";
import type { Filters, Priority } from "../types";

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  assignees: string[];
  tags: string[];
  resultCount: number;
  totalCount: number;
}

const QUICK_ITEMS: Array<{ key: Filters["quick"]; label: string }> = [
  { key: "all", label: "全部" },
  { key: "overdue", label: "已逾期" },
  { key: "week", label: "本周到期" },
  { key: "high", label: "高优先级" },
];

export function FilterBar({
  filters,
  onChange,
  assignees,
  tags,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const dirty =
    filters.query !== "" ||
    filters.priority !== "all" ||
    filters.assignee !== "all" ||
    filters.tag !== "all" ||
    filters.quick !== "all";

  const patch = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <section className="filter-bar" aria-label="筛选任务">
      <div className="search-box">
        <Search size={17} />
        <input
          type="search"
          value={filters.query}
          placeholder="搜索任务标题、描述、标签…"
          onChange={(e) => patch({ query: e.target.value })}
          aria-label="搜索任务"
        />
        {filters.query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => patch({ query: "" })}
            aria-label="清空搜索"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="quick-chips" role="group" aria-label="快捷筛选">
        {QUICK_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filters.quick === item.key ? "quick-chip active" : "quick-chip"}
            onClick={() => patch({ quick: item.key })}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="filter-selects">
        <label className="select-wrap" title="按优先级筛选">
          <SlidersHorizontal size={14} />
          <select
            value={filters.priority}
            onChange={(e) => patch({ priority: e.target.value as Priority | "all" })}
            aria-label="按优先级筛选"
          >
            <option value="all">全部优先级</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </label>

        <label className="select-wrap">
          <select
            value={filters.assignee}
            onChange={(e) => patch({ assignee: e.target.value })}
            aria-label="按负责人筛选"
          >
            <option value="all">全部负责人</option>
            {assignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="select-wrap">
          <select
            value={filters.tag}
            onChange={(e) => patch({ tag: e.target.value })}
            aria-label="按标签筛选"
          >
            <option value="all">全部标签</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-summary">
        <span>
          <b>{resultCount}</b> / {totalCount} 个任务
        </span>
        {dirty && (
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              onChange({
                query: "",
                priority: "all",
                assignee: "all",
                tag: "all",
                quick: "all",
              })
            }
          >
            清除筛选
          </button>
        )}
      </div>
    </section>
  );
}

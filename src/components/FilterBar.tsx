import { useId, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PRIORITY_ORDER, PRIORITY_META } from "../types";
import type { Filters, Priority } from "../types";
import "./stats-filters.css";

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

export function FilterBar({ filters, onChange, assignees, tags, resultCount, totalCount }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const advanced = [filters.priority, filters.assignee, filters.tag].filter(v => v !== "all").length;
  const dirty = Boolean(advanced || filters.query || filters.quick !== "all");
  const patch = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });
  return (
    <section className="sf-filters" aria-label="筛选任务">
      <div className="sf-toolbar">
        <div className="sf-quick" role="group" aria-label="快捷筛选">
          {QUICK_ITEMS.map(item => (
            <button key={item.key} type="button" aria-pressed={item.key === filters.quick} onClick={() => patch({ quick: item.key })}>{item.label}</button>
          ))}
        </div>
        <span className="sf-results" role="status">{dirty ? `${resultCount} / ${totalCount}` : totalCount} 个任务</span>
        <div className="sf-tools">
          <div className="sf-search">
            <Search size={15} aria-hidden="true" />
            <input type="search" value={filters.query} placeholder="搜索任务…" aria-label="搜索任务标题、描述或标签" onChange={e => patch({ query: e.target.value })} />
            {filters.query && <button type="button" aria-label="清空搜索" onClick={() => patch({ query: "" })}><X size={14} /></button>}
          </div>
          <button type="button" className="sf-more" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)}>
            <SlidersHorizontal size={15} />筛选{advanced > 0 && <b>{advanced}</b>}
          </button>
          {dirty && <button type="button" className="sf-reset" onClick={() => onChange({ query: "", priority: "all", assignee: "all", tag: "all", quick: "all" })}>清除筛选</button>}
        </div>
      </div>
      <div className="sf-advanced" id={panelId} hidden={!expanded}>
        <label>优先级<select aria-label="按优先级筛选" value={filters.priority} onChange={e => patch({ priority: e.target.value as Priority | "all" })}>
          <option value="all">全部优先级</option>{PRIORITY_ORDER.map(p => <option value={p} key={p}>{PRIORITY_META[p].label}</option>)}
        </select></label>
        <label>负责人<select aria-label="按负责人筛选" value={filters.assignee} onChange={e => patch({ assignee: e.target.value })}>
          <option value="all">全部负责人</option>{assignees.map(name => <option value={name} key={name}>{name}</option>)}
        </select></label>
        <label>标签<select aria-label="按标签筛选" value={filters.tag} onChange={e => patch({ tag: e.target.value })}>
          <option value="all">全部标签</option>{tags.map(tag => <option value={tag} key={tag}>#{tag}</option>)}
        </select></label>
      </div>
    </section>
  );
}

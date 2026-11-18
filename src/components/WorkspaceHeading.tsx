import { fmt } from '../utils/date';
import { useLocalDay } from '../hooks/useLocalDay';
import type { ViewKey } from '../types';

const headings: Record<ViewKey, string> = {
  today: '今天', board: '任务看板', calendar: '排期日历', timeline: '项目时间线',
};

export function WorkspaceHeading({ view }: { view: ViewKey }) {
  const day = useLocalDay();
  return <header className="workspace-heading planner-heading">
    <time dateTime={day}>{fmt(day, 'M月d日 EEEE')}</time>
    <h1>{headings[view]}</h1>
  </header>;
}

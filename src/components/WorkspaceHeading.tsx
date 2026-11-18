import { getISOWeek } from 'date-fns';
import type { ViewKey } from '../types';

const headings = {
  today: ['DAILY PLAN', '今日工作台'], board: ['KANBAN', '任务看板'], calendar: ['CALENDAR', '排期日历'], timeline: ['TIMELINE', '项目时间线'],
} as const;

export function WorkspaceHeading({ view }: { view: ViewKey }) {
  const today = new Date();
  const [code, title] = headings[view];
  return <section className="workspace-heading" aria-label="当前工作视图">
    <div><div className="workspace-code"><i />WORKSPACE <b>/</b> {code}</div><h1>{title}</h1></div>
    <div className="workspace-clock"><span>WEEK {String(getISOWeek(today)).padStart(2, '0')}</span><time dateTime={[today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-')}>{today.toLocaleDateString('zh-CN', {month:'long', day:'numeric', weekday:'long'})}</time></div>
  </section>;
}

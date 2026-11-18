import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import { zhCN } from "date-fns/locale";

export const toISO = (d: Date) => format(d, "yyyy-MM-dd");

export const fromISO = (s: string) => parseISO(s);

export const todayISO = () => toISO(new Date());

export const fmt = (iso: string | null, pattern = "M月d日") =>
  iso ? format(parseISO(iso), pattern, { locale: zhCN }) : "";

export const fmtLong = (iso: string | null) =>
  iso ? format(parseISO(iso), "yyyy年M月d日 EEE", { locale: zhCN }) : "";

export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export const startOfWeekMonday = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

export const daysBetween = (a: string, b: string) =>
  differenceInCalendarDays(parseISO(b), parseISO(a));

export const isToday = (iso: string) => isSameDay(parseISO(iso), new Date());

export const isOverdue = (dueDate: string | null, done: boolean) =>
  !!dueDate && !done && daysBetween(todayISO(), dueDate) < 0;

export const isDueThisWeek = (dueDate: string | null) => {
  if (!dueDate) return false;
  const start = startOfWeekMonday(new Date());
  const end = addDays(start, 7);
  return isWithinInterval(parseISO(dueDate), { start, end });
};

export const relativeDue = (dueDate: string | null) => {
  if (!dueDate) return { text: "", tone: "none" as const };
  const diff = daysBetween(todayISO(), dueDate);
  if (diff === 0) return { text: "今天到期", tone: "urgent" as const };
  if (diff === 1) return { text: "明天到期", tone: "soon" as const };
  if (diff < 0) return { text: `逾期 ${Math.abs(diff)} 天`, tone: "overdue" as const };
  if (diff <= 7) return { text: `${diff} 天后到期`, tone: "soon" as const };
  return { text: "", tone: "none" as const };
};

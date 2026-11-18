import { useEffect, useState } from 'react';
import { todayISO } from '../utils/date';

/** Read the local calendar day again after midnight or after the tab resumes. */
export function useLocalDay() {
  const [day, setDay] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setDay(todayISO());
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    refresh();
    const timer = window.setTimeout(refresh, midnight.getTime() - Date.now() + 10);
    window.addEventListener('focus', refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', refresh); };
  }, [day]);
  return day;
}

import { useRef, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { addDays } from "date-fns";
import { toISO } from "../utils/date";
import "./quick-capture.css";

type Due = "none" | "today" | "tomorrow";

export function QuickCapture({ onCapture }: { onCapture: (title: string, dueDate: string | null) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Due>("none");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);

  return (
    <form className="quick-capture" aria-label="快速记录任务" onSubmit={event => {
      event.preventDefault();
      const clean = title.trim();
      if (!clean || composing.current) return;
      const dueDate = due === "none" ? null : toISO(addDays(new Date(), due === "tomorrow" ? 1 : 0));
      onCapture(clean, dueDate);
      setTitle("");
      setDue("none");
      setNotice(`已记录：${clean}`);
      input.current?.focus();
    }}>
      <label className="quick-capture__title">
        <Plus size={20} aria-hidden="true" />
        <input ref={input} value={title} aria-label="任务标题" placeholder="快速记录任务…" enterKeyHint="done"
          onChange={e => { setTitle(e.target.value); setNotice(""); }}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={e => {
            // Some WebKit IMEs end composition before dispatching Enter (legacy keyCode 229).
            if (e.key === "Enter" && (composing.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)) e.preventDefault();
          }} />
      </label>
      <label className="quick-capture__due"><CalendarDays size={15} aria-hidden="true" />
        <select aria-label="截止日期" value={due} onChange={e => setDue(e.target.value as Due)}>
          <option value="none">不设截止</option><option value="today">今天截止</option><option value="tomorrow">明天截止</option>
        </select>
      </label>
      <button className="quick-capture__submit" type="submit" disabled={!title.trim()}>记录</button>
      <span className="quick-capture__notice" role="status">{notice}</span>
    </form>
  );
}

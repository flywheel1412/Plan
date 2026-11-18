import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { Status, Task } from "../types";
import { COLUMNS } from "../types";
import { cx } from "../utils/ui";
import { SortableTaskCard, TaskCardView } from "./TaskCard";

interface BoardProps {
  tasks: Task[];
  allTasks: Task[];
  onEdit: (task: Task) => void;
  onAdd: (status: Status) => void;
  moveTask: (id: string, status: Status, index?: number) => void;
  reorderTask: (id: string, overId: string) => void;
}

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id));

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } };
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };

interface ColumnProps {
  id: Status;
  title: string;
  hint: string;
  accent: string;
  tasks: Task[];
  highlight: boolean;
  onEdit: (task: Task) => void;
  onAdd: (status: Status) => void;
}

function Column({ id, title, hint, accent, tasks, highlight, onEdit, onAdd }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={cx("board-column", highlight && "is-over")}
      data-status={id}
      aria-label={title}
    >
      <header className="column-head">
        <span className="column-dot" style={{ background: accent }} />
        <div className="column-title-wrap">
          <h3 className="column-title">{title}</h3>
          <span className="column-hint">{hint}</span>
        </div>
        <span className="column-count">{tasks.length}</span>
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="column-list">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onEdit={onEdit} />
          ))}
          {tasks.length === 0 && (
            <div className="column-empty">
              <span>暂无任务</span>
              <small>拖动卡片到这里，或点击下方按钮新建</small>
            </div>
          )}
        </div>
      </SortableContext>

      <button type="button" className="column-add" onClick={() => onAdd(id)}>
        <Plus size={15} />
        添加任务
      </button>
    </section>
  );
}

export function Board({ tasks, allTasks, onEdit, onAdd, moveTask, reorderTask }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<Status | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  const columns = useMemo(() => {
    const grouped = new Map<Status, Task[]>();
    COLUMNS.forEach((col) => grouped.set(col.id, []));
    tasks.forEach((task) => grouped.get(task.status)?.push(task));
    grouped.forEach((list) => list.sort((a, b) => a.order - b.order));
    return grouped;
  }, [tasks]);

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeTaskId = String(active.id);
    const overId = String(over.id);
    const dragging = allTasks.find((t) => t.id === activeTaskId);
    if (!dragging) return;

    const overTask = allTasks.find((t) => t.id === overId);
    const targetStatus: Status | null = overTask
      ? overTask.status
      : COLUMN_IDS.has(overId)
        ? (overId as Status)
        : null;
    if (!targetStatus) return;

    setOverStatus(targetStatus);
    if (targetStatus === dragging.status) return;

    const targetList = allTasks
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.order - b.order);
    const index = overTask
      ? targetList.findIndex((t) => t.id === overTask.id)
      : targetList.length;
    moveTask(activeTaskId, targetStatus, index < 0 ? undefined : index);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeTaskId = String(active.id);
    setActiveId(null);
    setOverStatus(null);
    if (!over) return;
    const overId = String(over.id);
    if (overId === activeTaskId) return;

    if (COLUMN_IDS.has(overId)) {
      const status = overId as Status;
      const dragging = allTasks.find((t) => t.id === activeTaskId);
      if (dragging && dragging.status !== status) moveTask(activeTaskId, status);
      return;
    }

    const moving = allTasks.find((t) => t.id === activeTaskId);
    const overTask = allTasks.find((t) => t.id === overId);
    if (moving && overTask && moving.status === overTask.status) {
      reorderTask(activeTaskId, overId);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverStatus(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            hint={col.hint}
            accent={col.accent}
            tasks={columns.get(col.id) ?? []}
            highlight={overStatus === col.id}
            onEdit={onEdit}
            onAdd={onAdd}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeTask ? (
          <div className="drag-overlay-card">
            <TaskCardView task={activeTask} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

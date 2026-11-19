import { useCallback, useMemo, useState } from "react";
import {
  closestCorners,
  pointerWithin,
  DndContext,
  type CollisionDetection,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CircleCheck, CircleDot, CirclePause, GripVertical, Plus } from "lucide-react";
import type { Status, Task } from "../types";
import { COLUMNS } from "../types";
import { cx } from "../utils/ui";
import { SortableTaskCard, TaskCardView } from "./TaskCard";

import "./board-polish.css";

interface BoardProps {
  tasks: Task[];
  allTasks: Task[];
  onEdit: (task: Task) => void;
  onAdd: (status: Status) => void;
  moveTask: (id: string, status: Status, index?: number) => void;
  reorderTask: (id: string, overId: string) => void;
}

const COLUMN_IDS = new Set<string>(COLUMNS.map((column) => column.id));
const COLUMN_PREFIX = "column-";
const COLUMN_ORDER_KEY = "plan-kanban.columnOrder.v1";
const DEFAULT_COLUMN_ORDER = COLUMNS.map((column) => column.id);

const columnKey = (status: Status) => `${COLUMN_PREFIX}${status}`;

const statusOf = (id: string): Status | null => {
  const raw = id.startsWith(COLUMN_PREFIX) ? id.slice(COLUMN_PREFIX.length) : id;
  return COLUMN_IDS.has(raw) ? (raw as Status) : null;
};

/** Stored order is used only when it is a complete, duplicate-free set of statuses. */
function readColumnOrder(): Status[] {
  try {
    const raw = localStorage.getItem(COLUMN_ORDER_KEY);
    if (!raw) return DEFAULT_COLUMN_ORDER;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== DEFAULT_COLUMN_ORDER.length) {
      return DEFAULT_COLUMN_ORDER;
    }
    const seen = new Set(parsed);
    if (seen.size !== DEFAULT_COLUMN_ORDER.length) return DEFAULT_COLUMN_ORDER;
    return DEFAULT_COLUMN_ORDER.every((id) => seen.has(id))
      ? (parsed as Status[])
      : DEFAULT_COLUMN_ORDER;
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

// Columns are draggable only from their handle, so pointer hits include columns of both kinds.
// Keyboard drags have no pointer coordinates and must fall back to corner distance.
const boardCollisionDetection: CollisionDetection = (args) => {
  const isColumnDrag = args.active.data.current?.type === "column";
  if (isColumnDrag) {
    const columnContainers = args.droppableContainers.filter(
      (container) => statusOf(String(container.id)) != null,
    );
    if (args.pointerCoordinates) {
      const hits = pointerWithin(args).filter((hit) => statusOf(String(hit.id)) != null);
      if (hits.length) return hits;
    }
    return closestCorners({ ...args, droppableContainers: columnContainers });
  }

  const pointerHits = pointerWithin(args).filter(
    (hit) => !String(hit.id).startsWith(COLUMN_PREFIX),
  );
  if (!pointerHits.length) return closestCorners(args);
  const taskHit = pointerHits.find((hit) => !COLUMN_IDS.has(String(hit.id)));
  return taskHit ? [taskHit] : pointerHits;
};

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } };
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };

interface ColumnProps {
  id: Status;
  title: string;
  hint: string;
  tasks: Task[];
  highlight: boolean;
  onEdit: (task: Task) => void;
  onAdd: (status: Status) => void;
}

function SortableColumn({
  id,
  title,
  hint,
  tasks,
  highlight,
  onEdit,
  onAdd,
}: ColumnProps) {
  const StatusIcon = {
    todo: Circle,
    doing: CircleDot,
    postponed: CirclePause,
    done: CircleCheck,
  }[id];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: columnKey(id), data: { type: "column" } });
  const { setNodeRef: setDroppableRef } = useDroppable({ id });

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setDroppableRef(node);
    },
    [setNodeRef, setDroppableRef],
  );

  return (
    <section
      ref={setRefs}
      className={cx(
        "board-column",
        highlight && "is-over",
        isDragging && "is-column-dragging",
      )}
      data-status={id}
      aria-label={title}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <header className="column-head">
        <StatusIcon className="lane-icon" size={16} strokeWidth={2.25} aria-hidden="true" />
        <div className="column-title-wrap">
          <h3 className="column-title">{title}</h3>
          <span className="column-hint">{hint}</span>
        </div>
        <span className="column-count" aria-label={`${tasks.length} 个任务`}>{tasks.length}</span>
        <button
          type="button"
          className="column-grip"
          aria-label={`拖动调整「${title}」栏的位置`}
          title="拖动调整栏目顺序"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
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
  const [columnOrder, setColumnOrder] = useState<Status[]>(readColumnOrder);

  const sensors = useSensors(
    useSensor(MouseSensor, POINTER_SENSOR_OPTIONS),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  const columns = useMemo(() => {
    const grouped = new Map<Status, Task[]>();
    COLUMNS.forEach((column) => grouped.set(column.id, []));
    tasks.forEach((task) => grouped.get(task.status)?.push(task));
    grouped.forEach((list) => list.sort((a, b) => a.order - b.order));
    return grouped;
  }, [tasks]);

  const columnMeta = useMemo(
    () => new Map(COLUMNS.map((column) => [column.id, column])),
    [],
  );

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "column") return;
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.active.data.current?.type === "column") return;
    const { active, over } = event;
    if (!over) return;
    const activeTaskId = String(active.id);
    const overId = String(over.id);
    const dragging = allTasks.find((t) => t.id === activeTaskId);
    if (!dragging) return;

    const overTask = allTasks.find((t) => t.id === overId);
    const targetStatus: Status | null = overTask ? overTask.status : statusOf(overId);
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

    if (active.data.current?.type === "column") {
      if (!over || active.id === over.id) return;
      const from = statusOf(String(active.id));
      const to = statusOf(String(over.id));
      if (!from || !to || from === to) return;
      setColumnOrder((previous) => {
        const next = arrayMove(previous, previous.indexOf(from), previous.indexOf(to));
        try {
          localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
        } catch {
          /* storage may be unavailable; order still applies for this session */
        }
        return next;
      });
      return;
    }

    const activeTaskId = String(active.id);
    setActiveId(null);
    setOverStatus(null);
    if (!over) return;
    const overId = String(over.id);
    if (overId === activeTaskId) return;

    const targetStatus = statusOf(overId);
    if (targetStatus) {
      const dragging = allTasks.find((t) => t.id === activeTaskId);
      if (dragging && dragging.status !== targetStatus) {
        moveTask(activeTaskId, targetStatus);
      }
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
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board polished-board">
        <SortableContext
          items={columnOrder.map(columnKey)}
          strategy={horizontalListSortingStrategy}
        >
          {columnOrder.map((id) => {
            const meta = columnMeta.get(id);
            if (!meta) return null;
            return (
              <SortableColumn
                key={id}
                id={id}
                title={meta.title}
                hint={meta.hint}
                tasks={columns.get(id) ?? []}
                highlight={overStatus === id}
                onEdit={onEdit}
                onAdd={onAdd}
              />
            );
          })}
        </SortableContext>
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

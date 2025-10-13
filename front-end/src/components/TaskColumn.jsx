"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  if (typeof value === "object" && typeof value.seconds === "number")
    return new Date(value.seconds * 1000);
  return null;
}

const TAG_BASE =
  "rounded-full px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1";
const getStatusColor = (sRaw) => {
  const s = String(sRaw || "").toLowerCase();
  if (s === "to-do" || s === "todo")
    return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  if (s === "in progress" || s === "in-progress")
    return `${TAG_BASE} bg-blue-100 text-blue-700 border border-blue-200`;
  if (s === "completed" || s === "done")
    return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
  if (s === "blocked")
    return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
};
const getPriorityColor = (nRaw) => {
  const n = Number(nRaw);
  if (!Number.isFinite(n))
    return `${TAG_BASE} bg-gray-100 text-gray-700 border border-gray-200`;
  if (n >= 8)
    return `${TAG_BASE} bg-red-100 text-red-700 border border-red-200`;
  if (n >= 4)
    return `${TAG_BASE} bg-white text-yellow-700 border border-yellow-300`;
  return `${TAG_BASE} bg-emerald-100 text-emerald-700 border border-emerald-200`;
};

function TaskCard({ task, onTaskClick, onSubtaskClick }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  const hasSubtasks = (task.subtaskCount || 0) > 0;

  const handleToggleExpand = async (e) => {
    e.stopPropagation(); // Prevent task card click

    if (!isExpanded && subtasks.length === 0) {
      // Load subtasks on first expand
      setLoadingSubtasks(true);
      try {
        const { listSubtasks } = await import("@/lib/api");
        const data = await listSubtasks(task.projectId, task.id);
        setSubtasks(data || []);
      } catch (error) {
        console.error("Failed to load subtasks:", error);
        setSubtasks([]);
      } finally {
        setLoadingSubtasks(false);
      }
    }

    setIsExpanded(!isExpanded);
  };

  const handleSubtaskClick = (e, subtask) => {
    e.stopPropagation(); // Prevent task card click
    onSubtaskClick(subtask, task);
  };

  return (
    <Card className="hover:border-primary/40 transition">
      <div onClick={() => onTaskClick(task)} className="cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-foreground flex-1">
              {task.title}
            </CardTitle>
            {hasSubtasks && (
              <button
                onClick={handleToggleExpand}
                className="flex-shrink-0 p-1 hover:bg-muted rounded transition"
                aria-label={
                  isExpanded ? "Collapse subtasks" : "Expand subtasks"
                }
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            )}
          </div>
          {task.projectName && (
            <p className="text-xs text-muted-foreground truncate">
              {task.projectName}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(task.status)}>
              {task.status === "to-do"
                ? "To Do"
                : task.status === "in progress"
                ? "In Progress"
                : task.status === "blocked"
                ? "Blocked"
                : "Completed"}
            </Badge>
            <Badge className={getPriorityColor(task.priority)}>
              Priority {task.priority}
            </Badge>
          </div>

          {/* Subtask Progress Badge */}
          {hasSubtasks && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {task.subtaskCompletedCount || 0}/{task.subtaskCount || 0}{" "}
                subtasks
              </Badge>
              <span className="text-xs text-muted-foreground">
                {task.subtaskProgress || 0}%
              </span>
            </div>
          )}

          {task.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {(() => {
            const candidate =
              (task.assignee &&
                typeof task.assignee === "object" &&
                task.assignee.name) ||
              task.assigneeName ||
              (task.assigneeSummary && task.assigneeSummary.name) ||
              "";
            return candidate ? (
              <div className="text-xs text-muted-foreground">
                Assignee: {candidate}
              </div>
            ) : null;
          })()}

          {(() => {
            const names = Array.isArray(task.collaboratorNames)
              ? task.collaboratorNames
              : Array.isArray(task.collaborators)
              ? task.collaborators
                  .map((item) => (typeof item === "object" ? item?.name : item))
                  .filter(Boolean)
              : [];
            return names.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Collaborators: {names.join(", ")}
              </div>
            ) : null;
          })()}
          {(() => {
            const creatorId = task.createdBy;
            const creatorName =
              task.creatorName ||
              (task.creatorSummary && task.creatorSummary.name) ||
              (creatorId ? `User ${String(creatorId).slice(0, 4)}` : null);

            return creatorName ? (
              <div className="text-xs text-muted-foreground">
                Created by: {creatorName}
              </div>
            ) : null;
          })()}
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>
              {(() => {
                const due = toDate(task.dueDate);
                return due ? due.toLocaleDateString() : "—";
              })()}
            </span>
          </div>
        </CardContent>
      </div>

      {/* Collapsible Subtasks Section */}
      {isExpanded && (
        <CardContent className="pt-0 pb-3 border-t">
          {loadingSubtasks ? (
            <p className="text-xs text-muted-foreground py-2">
              Loading subtasks...
            </p>
          ) : subtasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No subtasks</p>
          ) : (
            <div className="space-y-1 mt-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  onClick={(e) => handleSubtaskClick(e, subtask)}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition text-xs"
                >
                  {subtask.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={`flex-1 truncate ${
                      subtask.status === "completed"
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function TaskColumn({
  title,
  color,
  tasks,
  onTaskClick,
  onSubtaskClick,
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-sm text-muted-foreground p-6">
              No tasks
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onTaskClick={onTaskClick}
              onSubtaskClick={onSubtaskClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

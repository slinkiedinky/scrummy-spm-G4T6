"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";

const STATUS_COLORS = {
  "to-do": "bg-slate-400",
  "in progress": "bg-blue-500",
  "completed": "bg-emerald-500",
  "blocked": "bg-red-500",
};

export function TeamTimeline({ tasks, teamMembers, resolveUserLabel }) {
  const [expandedDay, setExpandedDay] = useState(null);

  // Calculate timeline range (current week by default)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday

  // Generate timeline days for the current week
  const timelineDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  // Group tasks by day and member
  const tasksByDay = useMemo(() => {
    const grouped = new Map();

    timelineDays.forEach((day) => {
      grouped.set(day.toISOString(), []);
    });

    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const dueDate = new Date(task.dueDate);

      timelineDays.forEach((day) => {
        if (isSameDay(dueDate, day)) {
          const dayKey = day.toISOString();
          const assigneeId = task.assigneeId || task.ownerId;
          const assigneeName = assigneeId ? resolveUserLabel(assigneeId) : "Unassigned";

          grouped.get(dayKey).push({
            ...task,
            assigneeId,
            assigneeName,
          });
        }
      });
    });

    return grouped;
  }, [tasks, timelineDays, resolveUserLabel]);

  const toggleDay = (dayKey) => {
    setExpandedDay(expandedDay === dayKey ? null : dayKey);
  };

  // Group tasks by assignee for a specific day
  const getTasksByMember = (dayTasks) => {
    const grouped = new Map();

    dayTasks.forEach((task) => {
      const key = task.assigneeId || "unassigned";
      if (!grouped.has(key)) {
        grouped.set(key, {
          assigneeId: task.assigneeId,
          assigneeName: task.assigneeName,
          tasks: [],
        });
      }
      grouped.get(key).tasks.push(task);
    });

    return Array.from(grouped.values());
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Team Schedule</h2>
        <p className="text-sm text-muted-foreground">Click on a day to see who has tasks and their details</p>
      </div>

      {/* Condensed Timeline */}
      <div className="space-y-4">
        {/* Timeline Bar */}
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />

          {/* Days with events */}
          <div className="relative flex justify-between items-center">
            {timelineDays.map((day) => {
              const dayKey = day.toISOString();
              const dayTasks = tasksByDay.get(dayKey) || [];
              const isToday = isSameDay(day, today);
              const isExpanded = expandedDay === dayKey;
              const hasActiveTasks = dayTasks.some(t => t.status !== "completed");

              return (
                <div key={dayKey} className="flex flex-col items-center">
                  {/* Day label */}
                  <div className={`text-xs mb-2 ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    <div>{format(day, "EEE")}</div>
                    <div className="text-center">{format(day, "d")}</div>
                  </div>

                  {/* Event dot */}
                  <button
                    onClick={() => dayTasks.length > 0 && toggleDay(dayKey)}
                    className={`
                      relative z-10 rounded-full transition-all
                      ${dayTasks.length > 0
                        ? `${hasActiveTasks ? 'bg-primary' : 'bg-emerald-500'} hover:scale-125 cursor-pointer`
                        : 'bg-muted border-2 border-border'
                      }
                      ${isExpanded ? 'w-6 h-6 ring-4 ring-primary/30' : 'w-4 h-4'}
                      ${isToday && dayTasks.length > 0 ? 'ring-2 ring-primary ring-offset-2' : ''}
                    `}
                    title={dayTasks.length > 0 ? `${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}` : 'No tasks'}
                  >
                    {dayTasks.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-white text-primary text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-primary">
                        {dayTasks.length}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Active tasks</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>All completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-muted border-2 border-border" />
            <span>No tasks</span>
          </div>
        </div>

        {/* Expanded Day View */}
        {expandedDay && (
          <div className="mt-6 rounded-lg border border-primary/50 bg-primary/5 p-4 animate-in slide-in-from-top-2">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">
                {format(new Date(expandedDay), "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tasksByDay.get(expandedDay)?.length || 0} task{tasksByDay.get(expandedDay)?.length !== 1 ? 's' : ''} due
              </p>
            </div>

            {/* Group by team member */}
            <div className="space-y-4">
              {getTasksByMember(tasksByDay.get(expandedDay) || []).map((memberGroup) => (
                <div key={memberGroup.assigneeId || "unassigned"} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">
                      {memberGroup.assigneeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{memberGroup.assigneeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {memberGroup.tasks.length} task{memberGroup.tasks.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Tasks for this member */}
                  <div className="ml-10 space-y-2">
                    {memberGroup.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{task.title}</span>
                              <Badge
                                variant="outline"
                                className={`${STATUS_COLORS[task.status?.toLowerCase()] || STATUS_COLORS["to-do"]} text-white text-xs`}
                              >
                                {task.status}
                              </Badge>
                              {task.priority && (
                                <Badge variant="secondary" className="text-xs">
                                  Priority {task.priority}
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {task.description}
                              </p>
                            )}
                            {task.tags && task.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {task.tags.map((tag, idx) => (
                                  <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

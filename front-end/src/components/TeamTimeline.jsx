"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  const timelineRef = useRef(null);
  const todayRef = useRef(null);

  // Calculate timeline range dynamically based on tasks
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday

  // Find the latest task date
  const { timelineStart, timelineEnd } = useMemo(() => {
    const tasksWithDates = tasks.filter(t => t.dueDate).map(t => new Date(t.dueDate));

    if (tasksWithDates.length === 0) {
      // Default to current week if no tasks
      return {
        timelineStart: weekStart,
        timelineEnd: endOfWeek(today, { weekStartsOn: 1 })
      };
    }

    const latestTaskDate = new Date(Math.max(...tasksWithDates));
    const earliestTaskDate = new Date(Math.min(...tasksWithDates));

    // Start from the earlier of: current week start or earliest task
    const start = earliestTaskDate < weekStart ? startOfWeek(earliestTaskDate, { weekStartsOn: 1 }) : weekStart;

    // End at the later of: current week end or latest task
    const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const end = latestTaskDate > currentWeekEnd ? endOfWeek(latestTaskDate, { weekStartsOn: 1 }) : currentWeekEnd;

    return { timelineStart: start, timelineEnd: end };
  }, [tasks, today, weekStart]);

  // Generate timeline days from start to end
  const timelineDays = useMemo(() => {
    const days = [];
    let currentDay = new Date(timelineStart);

    while (currentDay <= timelineEnd) {
      days.push(new Date(currentDay));
      currentDay = addDays(currentDay, 1);
    }

    return days;
  }, [timelineStart, timelineEnd]);

  // Group tasks by day (no longer grouping by member since all assignees are equal)
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

          // Get all assignees (primary + collaborators)
          const allAssigneeIds = [
            task.assigneeId,
            ...(task.collaboratorsIds || [])
          ].filter(Boolean);

          const allAssigneeNames = allAssigneeIds.map(id => resolveUserLabel(id));

          grouped.get(dayKey).push({
            ...task,
            allAssigneeIds,
            allAssigneeNames,
          });
        }
      });
    });

    return grouped;
  }, [tasks, timelineDays, resolveUserLabel]);

  const toggleDay = (dayKey) => {
    setExpandedDay(expandedDay === dayKey ? null : dayKey);
  };

  // Auto-scroll to today on mount only
  useEffect(() => {
    if (todayRef.current && timelineRef.current) {
      const container = timelineRef.current;
      const todayElement = todayRef.current;
      const containerWidth = container.offsetWidth;
      const todayOffset = todayElement.offsetLeft;
      const todayWidth = todayElement.offsetWidth;

      // Scroll to center today in the view
      container.scrollLeft = todayOffset - (containerWidth / 2) + (todayWidth / 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Team Schedule</h2>
          <p className="text-sm text-muted-foreground">Click on a day to see who has tasks and their details • Scroll horizontally to see more days</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {timelineDays.length} days ({format(timelineStart, 'MMM d')} - {format(timelineEnd, 'MMM d')})
        </div>
      </div>

      {/* Condensed Timeline */}
      <div className="space-y-4">
        {/* Timeline Bar - Scrollable */}
        <div ref={timelineRef} className="relative overflow-x-auto pb-6 scroll-smooth">
          <div className="relative min-w-max px-8 py-6">
            {/* Days with events */}
            <div className="relative flex items-start gap-16">
              {timelineDays.map((day, index) => {
              const dayKey = day.toISOString();
              const dayTasks = tasksByDay.get(dayKey) || [];
              const isToday = isSameDay(day, today);
              const isExpanded = expandedDay === dayKey;
              const hasActiveTasks = dayTasks.some(t => t.status !== "completed");

              // Check if this is the first day of a new month
              const isFirstOfMonth = day.getDate() === 1 || index === 0;
              const showMonthLabel = isFirstOfMonth || (index > 0 && timelineDays[index - 1].getMonth() !== day.getMonth());

              return (
                <div key={dayKey} ref={isToday ? todayRef : null} className="flex flex-col items-center flex-shrink-0 relative">
                  {/* Month label */}
                  {showMonthLabel && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-foreground whitespace-nowrap bg-background px-2">
                      {format(day, "MMM yyyy")}
                    </div>
                  )}

                  {/* Day label */}
                  <div className={`text-xs mb-4 whitespace-nowrap text-center ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    <div>{format(day, "EEE")}</div>
                    <div>{format(day, "d")}</div>
                  </div>

                  {/* Vertical connector line */}
                  <div className="h-6 w-0.5 bg-border mb-1" />

                  {/* Event dot */}
                  <button
                    onClick={() => dayTasks.length > 0 && toggleDay(dayKey)}
                    className={`
                      relative z-10 rounded-full transition-all
                      ${dayTasks.length > 0
                        ? `${hasActiveTasks ? 'bg-primary' : 'bg-emerald-500'} hover:scale-125 cursor-pointer`
                        : 'bg-muted border-2 border-border'
                      }
                      ${isExpanded ? 'w-6 h-6 ring-4 ring-primary/30' : 'w-5 h-5'}
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

                  {/* Horizontal line extending to next day */}
                  {index < timelineDays.length - 1 && (
                    <div className="absolute top-[calc(100%-2.5rem)] left-1/2 w-16 h-0.5 bg-border" />
                  )}
                </div>
              );
            })}
            </div>
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

            {/* Tasks for this day - no grouping by member */}
            <div className="space-y-3">
              {(tasksByDay.get(expandedDay) || []).map((task) => (
                <div
                  key={task.id}
                  className="rounded-md border border-border bg-background p-4"
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

                      {/* Show all assigned members equally */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.allAssigneeNames && task.allAssigneeNames.length > 0 ? (
                          task.allAssigneeNames.map((name, idx) => (
                            <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </div>

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
        )}
      </div>
    </Card>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Copy, Trash2, Edit, Clock, CalendarIcon, Bell, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const TEAM_MEMBER_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-red-100 text-red-700 border-red-200',
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TeamCalendar({ teamMembers = [], currentUser }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userColors, setUserColors] = useState({});
  const [users, setUsers] = useState({});

  // Initialize user colors
  useEffect(() => {
    const colors = {};
    teamMembers.forEach((memberId, index) => {
      colors[memberId] = TEAM_MEMBER_COLORS[index % TEAM_MEMBER_COLORS.length];
    });
    setUserColors(colors);
  }, [teamMembers]);

  // Fetch user details
  useEffect(() => {
    const fetchUsers = async () => {
      const userDetails = {};
      for (const memberId of teamMembers) {
        try {
          const userDoc = await getDoc(doc(db, "users", memberId));
          if (userDoc.exists()) {
            userDetails[memberId] = userDoc.data();
          }
        } catch (error) {
          console.error(`Error fetching user ${memberId}:`, error);
        }
      }
      setUsers(userDetails);
    };

    if (teamMembers.length > 0) {
      fetchUsers();
    }
  }, [teamMembers]);

  // Fetch tasks for team members
  useEffect(() => {
    const fetchTasks = async () => {
      if (teamMembers.length === 0) return;

      setLoading(true);
      try {
        const allTasks = [];
        
        // Get all projects first
        const projectsSnapshot = await getDocs(collection(db, "projects"));
        const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch tasks from all projects for team members
        for (const project of projects) {
          const tasksRef = collection(db, "projects", project.id, "tasks");
          
          // Query for tasks assigned to team members
          for (const memberId of teamMembers) {
            try {
              const assignedTasksQuery = query(tasksRef, where("assigneeId", "==", memberId));
              const assignedSnapshot = await getDocs(assignedTasksQuery);
              
              const collaboratorTasksQuery = query(tasksRef, where("collaboratorsIds", "array-contains", memberId));
              const collaboratorSnapshot = await getDocs(collaboratorTasksQuery);
              
              // Combine and deduplicate tasks
              const taskMap = new Map();
              
              [...assignedSnapshot.docs, ...collaboratorSnapshot.docs].forEach(doc => {
                if (!taskMap.has(doc.id)) {
                  const taskData = doc.data();
                  taskMap.set(doc.id, {
                    id: doc.id,
                    projectId: project.id,
                    projectName: project.name,
                    title: taskData.title || taskData.name,
                    userId: taskData.assigneeId,
                    date: taskData.dueDate ? new Date(taskData.dueDate.seconds * 1000).toISOString().split('T')[0] : null,
                    time: "09:00", // Default time, you can adjust this based on your data
                    duration: 60, // Default duration
                    description: taskData.description || '',
                    status: taskData.status,
                    priority: taskData.priority,
                    ...taskData
                  });
                }
              });
              
              allTasks.push(...taskMap.values());
            } catch (error) {
              console.error(`Error fetching tasks for user ${memberId} in project ${project.id}:`, error);
            }
          }
        }

        setTasks(allTasks.filter(task => task.date)); // Only include tasks with dates
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [teamMembers, currentDate]);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatDayOfWeek = (date) => {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getMonthDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const dates = [];
    const current = new Date(startDate);
    while (current <= lastDay || dates.length % 7 !== 0) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const getTasksForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return tasks.filter((task) => task.date === dateStr);
  };

  const getUserColor = (userId) => {
    return userColors[userId] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getUserName = (userId) => {
    const user = users[userId];
    return user?.fullName || user?.name || user?.displayName || `User ${userId?.slice(0, 8)}`;
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const formatTime = (time) => {
    const [hours, minutes] = time.split(":");
    const hour = Number.parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading team calendar...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground uppercase">
                {currentDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </span>
              <span className="text-2xl font-semibold">{currentDate.getDate()}</span>
            </div>
            {viewMode === "day" && (
              <span className="text-sm text-muted-foreground">{formatDayOfWeek(currentDate)}</span>
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold">{formatDate(currentDate)}</h2>
            <span className="text-sm text-muted-foreground">Week {getWeekNumber(currentDate)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="day">Day view</option>
            <option value="week">Week view</option>
            <option value="month">Month view</option>
          </select>
        </div>
      </div>

      {/* Team Members Legend */}
      {teamMembers.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center p-4 border-b bg-muted/30">
          {teamMembers.map((memberId) => (
            <div key={memberId} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getUserColor(memberId)?.split(' ')[0] || 'bg-gray-200'}`}></div>
              <span className="text-sm text-gray-600">{getUserName(memberId)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Content */}
      <div className="w-full">
        {viewMode === "day" && (
          <DayView
            date={currentDate}
            tasks={getTasksForDate(currentDate)}
            onTaskClick={handleTaskClick}
            getUserColor={getUserColor}
            formatTime={formatTime}
          />
        )}
        {viewMode === "week" && (
          <WeekView
            dates={getWeekDates()}
            tasks={tasks}
            onTaskClick={handleTaskClick}
            getUserColor={getUserColor}
            formatTime={formatTime}
          />
        )}
        {viewMode === "month" && (
          <MonthView
            dates={getMonthDates()}
            currentMonth={currentDate.getMonth()}
            tasks={tasks}
            onTaskClick={handleTaskClick}
            getUserColor={getUserColor}
            formatTime={formatTime}
          />
        )}
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        getUserName={getUserName}
        getUserColor={getUserColor}
        formatTime={formatTime}
      />
    </div>
  );
}

// Keep your existing DayView, WeekView, MonthView, MiniCalendar, and TaskDetailModal components
// but update them to use the real data structure

function DayView({ date, tasks, onTaskClick, getUserColor, formatTime }) {
  return (
    <div className="flex w-full">
      <div className="flex-1 p-4">
        <div className="space-y-px">
          {HOURS.map((hour) => {
            const hourTasks = tasks.filter((task) => {
              const taskHour = task.time ? Number.parseInt(task.time.split(":")[0]) : 9;
              return taskHour === hour;
            });

            return (
              <div key={hour} className="flex border-b min-h-[60px]">
                <div className="w-20 pr-4 text-sm text-muted-foreground">
                  {hour === 0 ? "12 am" : hour < 12 ? `${hour} am` : hour === 12 ? "12 pm" : `${hour - 12} pm`}
                </div>
                <div className="flex-1 relative">
                  {hourTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        "absolute left-0 right-0 p-2 rounded-md border text-left text-sm",
                        getUserColor(task.userId),
                      )}
                      style={{ top: "4px" }}
                    >
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs opacity-80">{formatTime(task.time || "09:00")}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini Calendar Sidebar */}
      <div className="w-80 border-l p-4">
        <MiniCalendar currentDate={date} />
      </div>
    </div>
  );
}

function WeekView({ dates, tasks, onTaskClick, getUserColor, formatTime }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-8 gap-px bg-border rounded-lg overflow-hidden">
        {/* Time column header */}
        <div className="bg-background p-2"></div>

        {/* Day headers */}
        {dates.map((date, i) => {
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div key={i} className="bg-background p-2 text-center">
              <div className="text-sm text-muted-foreground">
                {DAYS_OF_WEEK[i]} {date.getDate()}
              </div>
              {isToday && (
                <div className="mt-1 w-8 h-8 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                  {date.getDate()}
                </div>
              )}
            </div>
          );
        })}

        {/* Time slots */}
        {HOURS.filter((h) => h >= 6 && h <= 23).map((hour) => (
          <React.Fragment key={hour}>
            <div className="bg-background p-2 text-sm text-muted-foreground">
              {hour === 0 ? "12 am" : hour < 12 ? `${hour} am` : hour === 12 ? "12 pm" : `${hour - 12} pm`}
            </div>
            {dates.map((date, i) => {
              const dateStr = date.toISOString().split("T")[0];
              const hourTasks = tasks.filter((task) => {
                const taskHour = task.time ? Number.parseInt(task.time.split(":")[0]) : 9;
                return task.date === dateStr && taskHour === hour;
              });

              return (
                <div key={`${i}-${hour}`} className="bg-background p-1 min-h-[80px] relative">
                  {hourTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={cn("w-full mb-1 p-2 rounded text-left text-xs border", getUserColor(task.userId))}
                    >
                      <div className="font-medium truncate">{task.title}</div>
                      <div className="opacity-80">{formatTime(task.time || "09:00")}</div>
                    </button>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MonthView({ dates, currentMonth, tasks, onTaskClick, getUserColor, formatTime }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Day headers */}
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="bg-background p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}

        {/* Date cells */}
        {dates.map((date, i) => {
          const dateStr = date.toISOString().split("T")[0];
          const dateTasks = tasks.filter((task) => task.date === dateStr);
          const isCurrentMonth = date.getMonth() === currentMonth;
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <div
              key={i}
              className={cn("bg-background p-2 min-h-[100px]", !isCurrentMonth && "text-muted-foreground opacity-50")}
            >
              <div
                className={cn(
                  "text-sm mb-1",
                  isToday &&
                    "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold",
                )}
              >
                {date.getDate()}
              </div>
              <div className="space-y-1">
                {dateTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className={cn("w-full p-1 rounded text-left text-xs border truncate", getUserColor(task.userId))}
                  >
                    <span className="font-medium">{task.title}</span>
                    <span className="ml-1 opacity-80">{formatTime(task.time || "09:00")}</span>
                  </button>
                ))}
                {dateTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">{dateTasks.length - 3} more...</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniCalendar({ currentDate }) {
  const dates = [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  const dayOfWeek = firstDay.getDay();
  startDate.setDate(firstDay.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const current = new Date(startDate);
  while (current <= lastDay || dates.length % 7 !== 0) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
            {day}
          </div>
        ))}
        {dates.map((date, i) => {
          const isCurrentMonth = date.getMonth() === month;
          const isSelected = date.toDateString() === currentDate.toDateString();

          return (
            <button
              key={i}
              className={cn(
                "aspect-square p-1 text-sm rounded-md hover:bg-accent relative",
                !isCurrentMonth && "text-muted-foreground opacity-50",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskDetailModal({ task, isOpen, onClose, getUserName, getUserColor, formatTime }) {
  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>
              {task.date && new Date(task.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Due: {formatTime(task.time || "09:00")}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
                  getUserColor(task.userId),
                )}
              >
                {getUserName(task.userId)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <span className="text-sm font-medium">{getUserName(task.userId)}</span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">About this task</h4>
            <p className="text-sm text-muted-foreground">{task.description || "No description available"}</p>
          </div>

          <div className="pt-2">
            <div className="text-sm">
              <span className="font-medium">Project: </span>
              <span className="text-muted-foreground">{task.projectName || "Unknown Project"}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="font-medium">Status: </span>
              <span className="text-muted-foreground">{task.status || "No status"}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="font-medium">Priority: </span>
              <span className="text-muted-foreground">{task.priority || "No priority"}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TeamCalendar;

"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, CalendarIcon, User, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TaskDetailModal } from "@/components/TaskDetailModal";

const STATUS_COLORS = {
  'to-do': 'bg-gray-100 text-gray-700 border-gray-200',
  'todo': 'bg-gray-100 text-gray-700 border-gray-200',
  'in progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'completed': 'bg-green-100 text-green-700 border-green-200',
  'done': 'bg-green-100 text-green-700 border-green-200',
  'blocked': 'bg-red-100 text-red-700 border-red-200',
};

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TeamCalendar({ teamMembers = [], currentUser, projectId }) {
  const [users, setUsers] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'schedule'

  // Fetch user details
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
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
      setLoading(false);
    };

    if (teamMembers.length > 0) {
      fetchUsers();
    }
  }, [teamMembers]);

  // Get user display name
  const getUserName = (userId) => {
    const user = users[userId];
    return user?.fullName || user?.name || user?.displayName || `User ${userId?.slice(0, 8)}`;
  };

  // Get user email
  const getUserEmail = (userId) => {
    const user = users[userId];
    return user?.email || '';
  };

  // Get user initials
  const getUserInitials = (userId) => {
    const name = getUserName(userId);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleViewSchedule = (memberId) => {
    setSelectedMember(memberId);
    setViewMode('schedule');
  };

  const handleBackToGrid = () => {
    setSelectedMember(null);
    setViewMode('grid');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading team members...</div>
      </div>
    );
  }

  // Show member schedule view
  if (viewMode === 'schedule' && selectedMember) {
    return (
      <MemberScheduleView
        memberId={selectedMember}
        memberName={getUserName(selectedMember)}
        projectId={projectId}
        currentUser={currentUser}
        onBack={handleBackToGrid}
      />
    );
  }

  // Show team members grid
  return (
    <div className="space-y-6">
      {/* Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((memberId) => {
          const user = users[memberId];
          const displayName = getUserName(memberId);
          const email = getUserEmail(memberId);
          
          return (
            <Card key={memberId} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.photoURL || user?.avatar} alt={displayName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getUserInitials(memberId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium truncate">
                      {displayName}
                    </CardTitle>
                    {email && (
                      <div className="flex items-center mt-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        <span className="truncate">{email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleViewSchedule(memberId)}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  View Schedule
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Member Schedule View Component (Full Screen)
function MemberScheduleView({ memberId, memberName, projectId, currentUser, onBack }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // Default to month view
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Fetch tasks for the specific member from the project
  useEffect(() => {
    const fetchMemberTasks = async () => {
      if (!memberId || !projectId) return;

      setLoading(true);
      try {
        const allTasks = [];
        
        // Query tasks from the specific project
        const tasksRef = collection(db, "projects", projectId, "tasks");
        
        try {
          // Get tasks where the member is assigned
          const assignedTasksQuery = query(tasksRef, where("assigneeId", "==", memberId));
          const assignedSnapshot = await getDocs(assignedTasksQuery);
          
          // Get tasks where the member is a collaborator
          const collaboratorTasksQuery = query(tasksRef, where("collaboratorsIds", "array-contains", memberId));
          const collaboratorSnapshot = await getDocs(collaboratorTasksQuery);
          
          // Combine and deduplicate tasks
          const taskMap = new Map();
          
          [...assignedSnapshot.docs, ...collaboratorSnapshot.docs].forEach(doc => {
            if (!taskMap.has(doc.id)) {
              const taskData = doc.data();
              
              // Convert Firebase timestamp to date string
              let dateStr = null;
              if (taskData.dueDate) {
                if (taskData.dueDate.seconds) {
                  // Firestore Timestamp
                  dateStr = new Date(taskData.dueDate.seconds * 1000).toISOString().split('T')[0];
                } else if (taskData.dueDate instanceof Date) {
                  // JavaScript Date
                  dateStr = taskData.dueDate.toISOString().split('T')[0];
                } else if (typeof taskData.dueDate === 'string') {
                  // String date
                  dateStr = new Date(taskData.dueDate).toISOString().split('T')[0];
                }
              }
              
              taskMap.set(doc.id, {
                id: doc.id,
                projectId: projectId,
                title: taskData.title || taskData.name,
                description: taskData.description || '',
                status: taskData.status,
                priority: taskData.priority,
                assigneeId: taskData.assigneeId,
                collaboratorsIds: taskData.collaboratorsIds || [],
                date: dateStr,
                dueDate: taskData.dueDate,
                createdAt: taskData.createdAt,
                updatedAt: taskData.updatedAt,
                ...taskData
              });
            }
          });
          
          allTasks.push(...taskMap.values());
        } catch (error) {
          console.error(`Error fetching tasks for user ${memberId} in project ${projectId}:`, error);
        }

        // Filter tasks that have dates
        setTasks(allTasks.filter(task => task.date));
      } catch (error) {
        console.error("Error fetching member tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberTasks();
  }, [memberId, projectId, currentDate]);

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
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

  const getStatusColor = (status) => {
    const normalizedStatus = String(status || '').toLowerCase();
    return STATUS_COLORS[normalizedStatus] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Team
        </Button>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{memberName}'s Schedule</h2>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h3>
            {viewMode === "week" && (
              <span className="text-sm text-muted-foreground">
                Week of {currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
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
            <option value="week">Week view</option>
            <option value="month">Month view</option>
          </select>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading schedule...</div>
          </div>
        ) : (
          <>
            {viewMode === "week" && (
              <MemberWeekView
                dates={getWeekDates()}
                tasks={tasks}
                onTaskClick={handleTaskClick}
                getStatusColor={getStatusColor}
              />
            )}
            {viewMode === "month" && (
              <MemberMonthView
                dates={getMonthDates()}
                currentMonth={currentDate.getMonth()}
                tasks={tasks}
                onTaskClick={handleTaskClick}
                getStatusColor={getStatusColor}
              />
            )}
          </>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

// Member Week View Component
function MemberWeekView({ dates, tasks, onTaskClick, getStatusColor }) {
  const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-8 gap-px bg-border">
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
        {HOURS.map((hour) => (
          <React.Fragment key={hour}>
            <div className="bg-background p-2 text-sm text-muted-foreground">
              {hour === 0 ? "12 am" : hour < 12 ? `${hour} am` : hour === 12 ? "12 pm" : `${hour - 12} pm`}
            </div>
            {dates.map((date, i) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayTasks = tasks.filter((task) => task.date === dateStr);

              return (
                <div key={`${i}-${hour}`} className="bg-background p-1 min-h-[60px] relative">
                  {dayTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        "w-full mb-1 p-2 rounded text-left text-xs border truncate hover:shadow-sm transition-shadow",
                        getStatusColor(task.status)
                      )}
                    >
                      <div className="font-medium truncate">{task.title}</div>
                      <div className="opacity-80 text-xs">{task.status}</div>
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

// Member Month View Component
function MemberMonthView({ dates, currentMonth, tasks, onTaskClick, getStatusColor }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 gap-px bg-border">
        {/* Day headers */}
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="bg-background p-3 text-center text-sm font-medium text-muted-foreground">
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
              className={cn(
                "bg-background p-2 min-h-[120px]",
                !isCurrentMonth && "text-muted-foreground opacity-50"
              )}
            >
              <div
                className={cn(
                  "text-sm mb-2 w-6 h-6 flex items-center justify-center",
                  isToday && "rounded-full bg-primary text-primary-foreground font-semibold"
                )}
              >
                {date.getDate()}
              </div>
              <div className="space-y-1">
                {dateTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className={cn(
                      "w-full p-1 rounded text-left text-xs border truncate hover:shadow-sm transition-shadow",
                      getStatusColor(task.status)
                    )}
                  >
                    <div className="font-medium truncate">{task.title}</div>
                  </button>
                ))}
                {dateTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    +{dateTasks.length - 3} more...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TeamCalendar;

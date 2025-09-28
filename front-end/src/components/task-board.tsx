"use client";

import { useMemo, useState } from "react";
import { TaskColumn } from "@/components/task-column";
import { TaskDetailModal } from "@/components/task-detail-modal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Filter } from "lucide-react";
import { CreateTaskModal } from "@/components/create-task-modal";
import useCurrentUser from "@/hooks/useCurrentUser";

import type { Project, Task } from "@/types/project";

interface TaskBoardProps {
  project: Project;
}

export function TaskBoard({ project }: TaskBoardProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const user = useCurrentUser();

  const tasks = project.tasks ?? [];

  const filteredTasks = useMemo(() => {
    return tasks.filter((task: any) => {
      const matchesSearch =
        (task.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesPriority =
        priorityFilter === "all" ||
        (() => {
          const taskPriority =
            typeof task.priority === "string"
              ? parseInt(task.priority)
              : task.priority;
          switch (priorityFilter) {
            case "critical":
              return taskPriority >= 9;
            case "high":
              return taskPriority >= 7 && taskPriority < 9;
            case "medium":
              return taskPriority >= 4 && taskPriority < 7;
            case "low":
              return taskPriority < 4;
            default:
              return true;
          }
        })();

      // Support either a string id or an { id, name } object
      const assigneeId =
        typeof task.assignee === "string"
          ? task.assignee
          : task.assignee?.id ?? task.assigneeId;
      const matchesAssignee =
        assigneeFilter === "all" || assigneeId === assigneeFilter;

      return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [tasks, searchTerm, priorityFilter, assigneeFilter]);

  const getTasksByStatus = (status: string) =>
    filteredTasks.filter(
      (task: any) =>
        (task.status || "").toLowerCase().replace(" ", "-") === status
    );

  const columns = [
    { id: "todo", title: "To Do", status: "todo", color: "bg-muted" },
    {
      id: "in-progress",
      title: "In Progress",
      status: "in-progress",
      color: "bg-primary",
    },
    { id: "review", title: "Review", status: "review", color: "bg-secondary" },
    {
      id: "completed",
      title: "Completed",
      status: "completed",
      color: "bg-chart-3",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header w/ Filters */}
      <div className="border-b border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Tasks</h2>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreateTask(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical (9-10)</SelectItem>
              <SelectItem value="high">High (7-8)</SelectItem>
              <SelectItem value="medium">Medium (4-6)</SelectItem>
              <SelectItem value="low">Low (1-3)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {project.team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
          {columns.map((col) => (
            <TaskColumn
              key={col.id}
              title={col.title}
              color={col.color}
              tasks={getTasksByStatus(col.status)}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onTaskCreated={() => {
          // Refresh tasks - you might need to add a callback prop to TaskBoard
          // or implement task fetching logic here
          window.location.reload(); // Temporary solution
        }}
        projectId={project.id}
        currentUser={user}
        projectTeam={project.team || []}
      />
    </div>
  );
}

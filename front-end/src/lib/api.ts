export async function fetchProjects() {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
    return res.json();
  }
  
export async function fetchMyTasks(userId: string) {
  const res = await fetch(`/api/my-tasks/${userId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

interface CreateTaskData {
  title: string;
  description?: string;
  priority: number;
  assigneeId: string;
  dueDate: string;
  status?: string;
  tags?: string[];
  collaborators?: string[];
  notes?: string;
  createdBy?: string;
  recurrence?: {
    enabled: boolean;
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
    value: number;
    endDate?: string;
    maxOccurrences?: number;
  };
}

// Create a new task within a project
export async function createProjectTask(projectId: string, taskData: CreateTaskData) {
  const response = await fetch(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create task');
  }

  return response.json();
}

// Create a standalone task
export async function createStandaloneTask(taskData: CreateTaskData) {
  const response = await fetch(`/api/standalone-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create standalone task');
  }

  return response.json();
}

// Complete a task (handles recurring task creation)
export async function completeTask(taskId: string, projectId?: string) {
  const response = await fetch(`/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to complete task');
  }

  return response.json();
}

// Get all users for assignment
export async function getAllUsers() {
  const response = await fetch(`/api/users`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch users');
  }

  return response.json();
}
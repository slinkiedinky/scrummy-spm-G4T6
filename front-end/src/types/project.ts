export interface TeamMember {
    id: string
    name: string
    email: string
    avatar: string
    role: string
    department: string
  }

  export type TaskStatus = "todo" | "in-progress" | "blocked" | "completed"
  
  export interface Task {
    id: string
    title: string
    description: string
    status: TaskStatus
    priority: "low" | "medium" | "high" | "urgent"
    dueDate: string
    createdAt: string
    updatedAt: string
    tags: string[]
    subtasks?: Task[]
    comments: Comment[]
    attachments: string[]
    estimatedHours?: number
    actualHours?: number
    isOverdue?: boolean
    assigneeId?: string
    assignee?: TeamMember
  }
  
  export interface Comment {
    id: string
    author: TeamMember
    content: string
    createdAt: string
  }
  
  export interface Project {
    id: string
    name: string
    description: string
    status: "planning" | "active" | "on-hold" | "completed"
    priority: "low" | "medium" | "high" | "urgent"
    dueDate: string
    createdAt: string
    updatedAt: string
    team: TeamMember[]
    tasks: Task[]
    progress: number
    budget?: number
    client?: string
    department: string
    riskLevel: "low" | "medium" | "high"
    completionPercentage: number
    overduePercentage: number
    medianDaysOverdue: number
  }
  
  export interface ProjectFilters {
    projects?: string[]
    departments?: string[]
    employees?: string[]
    taskStatuses?: string[]
    dateRange?: {
      start: string
      end: string
    }
    riskLevels?: string[]
  }
  
  export interface SortOption {
    field: "overduePercentage" | "completionPercentage" | "dueDate" | "name"
    direction: "asc" | "desc"
  }
  
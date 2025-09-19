import type { Project, TeamMember, Task } from "@/types/project"

export const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah@company.com",
    avatar: "/professional-woman-avatar.png",
    role: "Project Manager",
    department: "Engineering",
  },
  {
    id: "2",
    name: "Mike Chen",
    email: "mike@company.com",
    avatar: "/professional-man-avatar.png",
    role: "Frontend Developer",
    department: "Engineering",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily@company.com",
    avatar: "/professional-woman-avatar.png",
    role: "UI/UX Designer",
    department: "Design",
  },
  {
    id: "4",
    name: "David Kim",
    email: "david@company.com",
    avatar: "/professional-man-avatar.png",
    role: "Backend Developer",
    department: "Engineering",
  },
  {
    id: "5",
    name: "Lisa Thompson",
    email: "lisa@company.com",
    avatar: "/professional-woman-avatar.png",
    role: "QA Engineer",
    department: "Quality Assurance",
  },
  {
    id: "6",
    name: "Alex Rivera",
    email: "alex@company.com",
    avatar: "/professional-man-avatar.png",
    role: "DevOps Engineer",
    department: "Engineering",
  },
]

export const mockTasks: Task[] = [
  {
    id: "1",
    title: "Design user authentication flow",
    description: "Create wireframes and mockups for the login and registration process",
    status: "completed",
    priority: "high",
    assignee: mockTeamMembers[2],
    dueDate: "2024-01-15",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-14",
    tags: ["design", "auth"],
    comments: [],
    attachments: [],
    estimatedHours: 16,
    actualHours: 14,
    isOverdue: false,
  },
  {
    id: "2",
    title: "Implement user registration API",
    description: "Build backend endpoints for user registration with validation",
    status: "in-progress",
    priority: "high",
    assignee: mockTeamMembers[3],
    dueDate: "2024-01-18", // Overdue
    createdAt: "2024-01-05",
    updatedAt: "2024-01-18",
    tags: ["backend", "api"],
    comments: [],
    attachments: [],
    estimatedHours: 24,
    actualHours: 18,
    isOverdue: true,
  },
  {
    id: "3",
    title: "Create responsive dashboard layout",
    description: "Build the main dashboard interface with responsive design",
    status: "blocked",
    priority: "medium",
    assignee: mockTeamMembers[1],
    dueDate: "2024-01-20", // Overdue
    createdAt: "2024-01-10",
    updatedAt: "2024-01-19",
    tags: ["frontend", "responsive"],
    comments: [],
    attachments: [],
    estimatedHours: 32,
    actualHours: 20,
    isOverdue: true,
  },
  {
    id: "4",
    title: "Set up automated testing",
    description: "Configure Jest and Cypress for unit and integration testing",
    status: "todo",
    priority: "medium",
    assignee: mockTeamMembers[4],
    dueDate: "2024-01-25",
    createdAt: "2024-01-12",
    updatedAt: "2024-01-12",
    tags: ["testing", "automation"],
    comments: [],
    attachments: [],
    estimatedHours: 20,
    isOverdue: false,
  },
  {
    id: "5",
    title: "Database optimization",
    description: "Optimize database queries and add proper indexing",
    status: "in-progress",
    priority: "high",
    assignee: mockTeamMembers[3],
    dueDate: "2024-01-22",
    createdAt: "2024-01-08",
    updatedAt: "2024-01-20",
    tags: ["database", "performance"],
    comments: [],
    attachments: [],
    estimatedHours: 16,
    actualHours: 12,
    isOverdue: false,
  },
]

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "E-commerce Platform Redesign",
    description: "Complete overhaul of the existing e-commerce platform with modern UI/UX",
    status: "active",
    priority: "high",
    dueDate: "2024-03-15",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-19",
    team: [mockTeamMembers[0], mockTeamMembers[1], mockTeamMembers[2]],
    tasks: mockTasks.slice(0, 3),
    progress: 65,
    budget: 150000,
    client: "TechCorp Inc.",
    department: "Engineering",
    riskLevel: "medium",
    completionPercentage: 65,
    overduePercentage: 33,
    medianDaysOverdue: 2,
  },
  {
    id: "2",
    name: "Mobile App Development",
    description: "Native iOS and Android app for customer engagement",
    status: "active",
    priority: "medium",
    dueDate: "2024-04-30",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-19",
    team: [mockTeamMembers[0], mockTeamMembers[3], mockTeamMembers[4]],
    tasks: [mockTasks[3], mockTasks[4]],
    progress: 25,
    budget: 200000,
    client: "StartupXYZ",
    department: "Engineering",
    riskLevel: "low",
    completionPercentage: 25,
    overduePercentage: 0,
    medianDaysOverdue: 0,
  },
  {
    id: "3",
    name: "Data Analytics Dashboard",
    description: "Business intelligence dashboard for real-time analytics",
    status: "planning",
    priority: "medium",
    dueDate: "2024-05-20",
    createdAt: "2024-01-20",
    updatedAt: "2024-01-20",
    team: [mockTeamMembers[1], mockTeamMembers[3]],
    tasks: [],
    progress: 10,
    budget: 80000,
    client: "DataCorp",
    department: "Engineering",
    riskLevel: "low",
    completionPercentage: 10,
    overduePercentage: 0,
    medianDaysOverdue: 0,
  },
  {
    id: "4",
    name: "Legacy System Migration",
    description: "Migrate legacy systems to modern cloud infrastructure",
    status: "on-hold",
    priority: "low",
    dueDate: "2024-06-30",
    createdAt: "2024-01-10",
    updatedAt: "2024-01-18",
    team: [mockTeamMembers[3], mockTeamMembers[4]],
    tasks: [],
    progress: 5,
    budget: 300000,
    client: "Enterprise Corp",
    department: "Engineering",
    riskLevel: "high",
    completionPercentage: 5,
    overduePercentage: 0,
    medianDaysOverdue: 0,
  },
  {
    id: "5",
    name: "Website Performance Optimization",
    description: "Optimize website performance and SEO improvements",
    status: "completed",
    priority: "high",
    dueDate: "2024-01-10",
    createdAt: "2023-12-01",
    updatedAt: "2024-01-10",
    team: [mockTeamMembers[1], mockTeamMembers[2]],
    tasks: [],
    progress: 100,
    budget: 25000,
    client: "SmallBiz LLC",
    department: "Marketing",
    riskLevel: "low",
    completionPercentage: 100,
    overduePercentage: 0,
    medianDaysOverdue: 0,
  },
]

export const calculateProjectMetrics = (project: Project) => {
  const totalTasks = project.tasks.length
  if (totalTasks === 0) return project

  const completedTasks = project.tasks.filter((task) => task.status === "completed").length
  const overdueTasks = project.tasks.filter((task) => task.isOverdue).length

  const completionPercentage = Math.round((completedTasks / totalTasks) * 100)
  const overduePercentage = Math.round((overdueTasks / totalTasks) * 100)

  // Calculate median days overdue
  const overdueDays = project.tasks
    .filter((task) => task.isOverdue)
    .map((task) => {
      const dueDate = new Date(task.dueDate)
      const today = new Date()
      return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    })
    .sort((a, b) => a - b)

  const medianDaysOverdue = overdueDays.length > 0 ? overdueDays[Math.floor(overdueDays.length / 2)] : 0

  return {
    ...project,
    completionPercentage,
    overduePercentage,
    medianDaysOverdue,
  }
}

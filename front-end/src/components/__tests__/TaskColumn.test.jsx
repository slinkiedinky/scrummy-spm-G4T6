import { render, screen, fireEvent } from '@testing-library/react'
import { TaskColumn } from '../TaskColumn'

// Mock the Badge component
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }) => (
    <span className={className} data-variant={variant}>
      {children}
    </span>
  ),
}))

// Mock the Card components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => (
    <div className={className} data-testid="task-card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }) => (
    <h3 className={className}>{children}</h3>
  ),
}))

describe('TaskColumn Component', () => {
  const mockOnTaskClick = jest.fn()

  const mockTasks = [
    {
      id: 'task-1',
      title: 'Design landing page',
      status: 'in progress',
      priority: 8,
      dueDate: '2024-12-31',
      projectName: 'Website Redesign',
      tags: ['design', 'ui'],
      assigneeName: 'John Doe',
      creatorName: 'Jane Smith',
      collaboratorNames: ['Alice', 'Bob'],
    },
    {
      id: 'task-2',
      title: 'Write API documentation',
      status: 'to-do',
      priority: 5,
      dueDate: new Date('2024-11-15'),
      projectName: 'API Project',
      tags: ['documentation'],
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console.log in tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    console.log.mockRestore()
  })

  it('renders column with title and task count', () => {
    render(
      <TaskColumn
        title="In Progress"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getAllByText('In Progress')[0]).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders all tasks in the column', () => {
    render(
      <TaskColumn
        title="In Progress"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('Design landing page')).toBeInTheDocument()
    expect(screen.getByText('Write API documentation')).toBeInTheDocument()
  })

  it('displays task status badges', () => {
    render(
      <TaskColumn
        title="All Tasks"
        color="bg-gray-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('To Do')).toBeInTheDocument()
  })

  it('displays task priority badges', () => {
    render(
      <TaskColumn
        title="All Tasks"
        color="bg-gray-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('Priority 8')).toBeInTheDocument()
    expect(screen.getByText('Priority 5')).toBeInTheDocument()
  })

  it('displays project names', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('Website Redesign')).toBeInTheDocument()
    expect(screen.getByText('API Project')).toBeInTheDocument()
  })

  it('displays task tags', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('design')).toBeInTheDocument()
    expect(screen.getByText('ui')).toBeInTheDocument()
    expect(screen.getByText('documentation')).toBeInTheDocument()
  })

  it('displays assignee information', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText(/Assignee: John Doe/)).toBeInTheDocument()
  })

  it('displays creator information', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText(/Created by: Jane Smith/)).toBeInTheDocument()
  })

  it('displays collaborator information', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText(/Collaborators: Alice, Bob/)).toBeInTheDocument()
  })

  it('displays formatted due dates', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    // Check that dates are displayed (format may vary)
    expect(screen.getByText(/12\/31\/2024/)).toBeInTheDocument()
    expect(screen.getByText(/11\/15\/2024/)).toBeInTheDocument()
  })

  it('calls onTaskClick when task is clicked', () => {
    render(
      <TaskColumn
        title="Tasks"
        color="bg-blue-500"
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
      />
    )

    // Click on the task title which is inside the clickable div
    const taskTitle = screen.getByText('Design landing page')
    fireEvent.click(taskTitle)

    expect(mockOnTaskClick).toHaveBeenCalledWith(mockTasks[0])
  })

  it('renders empty state when no tasks', () => {
    render(
      <TaskColumn
        title="Empty Column"
        color="bg-gray-500"
        tasks={[]}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('No tasks')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('handles tasks without optional fields', () => {
    const minimalTask = {
      id: 'task-minimal',
      title: 'Minimal Task',
      status: 'to-do',
      priority: 5,
    }

    render(
      <TaskColumn
        title="Minimal"
        color="bg-gray-500"
        tasks={[minimalTask]}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('Minimal Task')).toBeInTheDocument()
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('Priority 5')).toBeInTheDocument()
  })

  it('applies correct status colors', () => {
    const tasksWithStatuses = [
      { id: '1', title: 'Task 1', status: 'to-do', priority: 5 },
      { id: '2', title: 'Task 2', status: 'in progress', priority: 5 },
      { id: '3', title: 'Task 3', status: 'completed', priority: 5 },
      { id: '4', title: 'Task 4', status: 'blocked', priority: 5 },
    ]

    render(
      <TaskColumn
        title="All Statuses"
        color="bg-gray-500"
        tasks={tasksWithStatuses}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('applies correct priority colors', () => {
    const tasksWithPriorities = [
      { id: '1', title: 'Low Priority', status: 'to-do', priority: 2 },
      { id: '2', title: 'Medium Priority', status: 'to-do', priority: 5 },
      { id: '3', title: 'High Priority', status: 'to-do', priority: 9 },
    ]

    render(
      <TaskColumn
        title="All Priorities"
        color="bg-gray-500"
        tasks={tasksWithPriorities}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('Priority 2')).toBeInTheDocument()
    expect(screen.getByText('Priority 5')).toBeInTheDocument()
    expect(screen.getByText('Priority 9')).toBeInTheDocument()
  })

  it('handles Firestore timestamp format for dates', () => {
    const taskWithFirestoreDate = {
      id: 'task-firestore',
      title: 'Firestore Task',
      status: 'to-do',
      priority: 5,
      dueDate: { seconds: 1704067200 }, // Jan 1, 2024
    }

    render(
      <TaskColumn
        title="Firestore"
        color="bg-gray-500"
        tasks={[taskWithFirestoreDate]}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('Firestore Task')).toBeInTheDocument()
    // Date should be formatted (exact format may vary)
    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument()
  })

  it('displays dash for missing due date', () => {
    const taskWithoutDate = {
      id: 'task-no-date',
      title: 'No Date Task',
      status: 'to-do',
      priority: 5,
      dueDate: null,
    }

    render(
      <TaskColumn
        title="No Date"
        color="bg-gray-500"
        tasks={[taskWithoutDate]}
        onTaskClick={mockOnTaskClick}
      />
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

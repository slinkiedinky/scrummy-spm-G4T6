import { render, screen } from '@testing-library/react'
import { ProjectOverview } from '../ProjectOverview'

// Mock dependencies
jest.mock('lucide-react', () => ({
  Calendar: () => <span>Calendar</span>,
  Clock: () => <span>Clock</span>,
  Target: () => <span>Target</span>,
  TrendingUp: () => <span>TrendingUp</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <div data-testid="card-title">{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }) => <span data-testid="badge" className={className}>{children}</span>,
}))

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }) => <div data-testid="progress" data-value={value}>Progress: {value}%</div>,
}))

describe('ProjectOverview', () => {
  const mockProject = {
    id: 'project-1',
    title: 'Test Project',
    description: 'Test project description',
    status: 'in progress',
    priority: 7,
    progress: 45,
    dueDate: new Date('2025-12-31').toISOString(),
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-10-20').toISOString(),
    client: 'ACME Corp',
    budget: 50000,
    tasks: [
      {
        id: 'task-1',
        title: 'Task 1',
        status: 'completed',
        dueDate: new Date('2025-11-01').toISOString(),
      },
      {
        id: 'task-2',
        title: 'Task 2',
        status: 'in progress',
        dueDate: new Date('2025-11-15').toISOString(),
      },
      {
        id: 'task-3',
        title: 'Task 3',
        status: 'to-do',
        dueDate: new Date('2025-10-25').toISOString(), // Overdue
      },
    ],
  }

  describe('Key Metrics Display', () => {
    it('renders total tasks count correctly', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('1 completed, 1 in progress')).toBeInTheDocument()
    })

    it('renders progress percentage and bar', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('45%')).toBeInTheDocument()
      const progressBar = screen.getByTestId('progress')
      expect(progressBar).toHaveAttribute('data-value', '45')
    })

    it('calculates days remaining correctly for future due date', () => {
      render(<ProjectOverview project={mockProject} />)
      // Should show positive days remaining
      const daysCard = screen.getByText(/Due December/i).closest('[data-testid="card-content"]')
      expect(daysCard).toBeInTheDocument()
    })

    it('shows overdue status for past due date', () => {
      const overdueProject = {
        ...mockProject,
        dueDate: new Date('2025-01-01').toISOString(), // Past date
      }
      render(<ProjectOverview project={overdueProject} />)
      expect(screen.getByText(/overdue/i)).toBeInTheDocument()
    })

    it('counts overdue tasks correctly', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('1')).toBeInTheDocument() // One overdue task
      expect(screen.getByText('Needs attention')).toBeInTheDocument()
    })

    it('shows "All on track" when no overdue tasks', () => {
      const onTrackProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'completed',
            dueDate: new Date('2025-11-01').toISOString(),
          },
          {
            id: 'task-2',
            title: 'Task 2',
            status: 'in progress',
            dueDate: new Date('2025-11-15').toISOString(),
          },
        ],
      }
      render(<ProjectOverview project={onTrackProject} />)
      expect(screen.getByText('All on track')).toBeInTheDocument()
    })
  })

  describe('Priority Resolution', () => {
    it('resolves high priority for numbers >= 8', () => {
      const highPriorityProject = { ...mockProject, priority: 9 }
      render(<ProjectOverview project={highPriorityProject} />)
      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })

    it('resolves low priority for numbers <= 3', () => {
      const lowPriorityProject = { ...mockProject, priority: 2 }
      render(<ProjectOverview project={lowPriorityProject} />)
      expect(screen.getByText('Low Priority')).toBeInTheDocument()
    })

    it('resolves medium priority for numbers 4-7', () => {
      const mediumPriorityProject = { ...mockProject, priority: 5 }
      render(<ProjectOverview project={mediumPriorityProject} />)
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })

    it('resolves string priority "high"', () => {
      const stringPriorityProject = { ...mockProject, priority: 'high' }
      render(<ProjectOverview project={stringPriorityProject} />)
      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })

    it('resolves string priority "low"', () => {
      const stringPriorityProject = { ...mockProject, priority: 'low' }
      render(<ProjectOverview project={stringPriorityProject} />)
      expect(screen.getByText('Low Priority')).toBeInTheDocument()
    })

    it('resolves string priority "medium"', () => {
      const stringPriorityProject = { ...mockProject, priority: 'medium' }
      render(<ProjectOverview project={stringPriorityProject} />)
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })

    it('defaults to medium for invalid priority', () => {
      const invalidPriorityProject = { ...mockProject, priority: 'invalid' }
      render(<ProjectOverview project={invalidPriorityProject} />)
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })

    it('defaults to medium for null priority', () => {
      const nullPriorityProject = { ...mockProject, priority: null }
      render(<ProjectOverview project={nullPriorityProject} />)
      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })

    it('parses numeric string priority', () => {
      const numericStringProject = { ...mockProject, priority: '9' }
      render(<ProjectOverview project={numericStringProject} />)
      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })
  })

  describe('Upcoming Deadlines', () => {
    it('shows upcoming deadlines sorted by urgency', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument()
      expect(screen.getByText('Task 3')).toBeInTheDocument() // Overdue task shown first
    })

    it('shows "No upcoming deadlines" when all tasks completed', () => {
      const completedProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'completed',
            dueDate: new Date('2025-11-01').toISOString(),
          },
        ],
      }
      render(<ProjectOverview project={completedProject} />)
      expect(screen.getByText('No upcoming deadlines')).toBeInTheDocument()
    })

    it('shows overdue badge for past due tasks', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText(/days overdue/i)).toBeInTheDocument()
    })

    it('shows "Due today" badge for tasks due today', () => {
      const todayProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Today Task',
            status: 'in progress',
            dueDate: new Date().toISOString(),
          },
        ],
      }
      render(<ProjectOverview project={todayProject} />)
      expect(screen.getByText('Due today')).toBeInTheDocument()
    })

    it('shows "Due tomorrow" badge for tasks due tomorrow', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Tomorrow Task',
            status: 'in progress',
            dueDate: tomorrow.toISOString(),
          },
        ],
      }
      render(<ProjectOverview project={tomorrowProject} />)
      expect(screen.getByText('Due tomorrow')).toBeInTheDocument()
    })

    it('shows days left badge for future tasks', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      const futureProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Future Task',
            status: 'in progress',
            dueDate: futureDate.toISOString(),
          },
        ],
      }
      render(<ProjectOverview project={futureProject} />)
      expect(screen.getByText(/days left/i)).toBeInTheDocument()
    })

    it('limits upcoming deadlines to top 5', () => {
      const manyTasksProject = {
        ...mockProject,
        tasks: Array.from({ length: 10 }, (_, i) => ({
          id: `task-${i}`,
          title: `Task ${i}`,
          status: 'in progress',
          dueDate: new Date(2025, 11, i + 1).toISOString(),
        })),
      }
      render(<ProjectOverview project={manyTasksProject} />)
      const taskElements = screen.getAllByText(/Task \d/)
      expect(taskElements.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Project Information Display', () => {
    it('renders project description', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('Test project description')).toBeInTheDocument()
    })

    it('renders project status badge with correct styling', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('In progress')).toBeInTheDocument()
    })

    it('handles "to-do" status correctly', () => {
      const todoProject = { ...mockProject, status: 'to-do' }
      render(<ProjectOverview project={todoProject} />)
      expect(screen.getByText('To do')).toBeInTheDocument()
    })

    it('handles "completed" status correctly', () => {
      const completedProject = { ...mockProject, status: 'completed' }
      render(<ProjectOverview project={completedProject} />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('handles "blocked" status correctly', () => {
      const blockedProject = { ...mockProject, status: 'blocked' }
      render(<ProjectOverview project={blockedProject} />)
      expect(screen.getByText('Blocked')).toBeInTheDocument()
    })

    it('shows "Unknown" for missing status', () => {
      const noStatusProject = { ...mockProject, status: null }
      render(<ProjectOverview project={noStatusProject} />)
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })

    it('renders client information when present', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('ACME Corp')).toBeInTheDocument()
    })

    it('does not render client section when missing', () => {
      const noClientProject = { ...mockProject, client: null }
      render(<ProjectOverview project={noClientProject} />)
      expect(screen.queryByText('Client')).not.toBeInTheDocument()
    })

    it('renders budget information when present', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText('$50,000')).toBeInTheDocument()
    })

    it('does not render budget section when missing', () => {
      const noBudgetProject = { ...mockProject, budget: null }
      render(<ProjectOverview project={noBudgetProject} />)
      const budgetLabels = screen.queryAllByText('Budget')
      expect(budgetLabels.length).toBe(0)
    })
  })

  describe('Timeline Display', () => {
    it('renders creation date', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText(/January 1, 2025/i)).toBeInTheDocument()
    })

    it('renders last updated date', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText(/October 20, 2025/i)).toBeInTheDocument()
    })

    it('renders due date', () => {
      render(<ProjectOverview project={mockProject} />)
      expect(screen.getByText(/December 31, 2025/i)).toBeInTheDocument()
    })

    it('shows "(Overdue)" label for past due date', () => {
      const overdueProject = {
        ...mockProject,
        dueDate: new Date('2025-01-01').toISOString(),
      }
      render(<ProjectOverview project={overdueProject} />)
      expect(screen.getByText('(Overdue)')).toBeInTheDocument()
    })

    it('calculates project duration correctly', () => {
      render(<ProjectOverview project={mockProject} />)
      // From Jan 1 to Dec 31 = 364 days
      expect(screen.getByText(/364/)).toBeInTheDocument()
      expect(screen.getByText(/days/)).toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('formats dates in US locale', () => {
      render(<ProjectOverview project={mockProject} />)
      // Check for month name format
      expect(screen.getByText(/January/i)).toBeInTheDocument()
    })
  })

  describe('Empty States', () => {
    it('handles project with no tasks', () => {
      const emptyProject = {
        ...mockProject,
        tasks: [],
      }
      render(<ProjectOverview project={emptyProject} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('No upcoming deadlines')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles tasks with no due date', () => {
      const noDueDateProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'in progress',
            dueDate: null,
          },
        ],
      }
      render(<ProjectOverview project={noDueDateProject} />)
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    it('handles mixed case status strings', () => {
      const mixedCaseProject = { ...mockProject, status: 'In Progress' }
      render(<ProjectOverview project={mixedCaseProject} />)
      // Should normalize to proper case
      expect(screen.getByText('In progress')).toBeInTheDocument()
    })
  })
})

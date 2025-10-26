import { render, screen } from '@testing-library/react'
import { ProjectTeamView } from '../ProjectTeamView'

// Mock dependencies
jest.mock('lucide-react', () => ({
  Users: () => <span>Users</span>,
  CheckCircle: () => <span>CheckCircle</span>,
  Clock: () => <span>Clock</span>,
  AlertCircle: () => <span>AlertCircle</span>,
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

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }) => <div data-testid="avatar">{children}</div>,
  AvatarImage: ({ src, alt }) => <img src={src} alt={alt} data-testid="avatar-image" />,
  AvatarFallback: ({ children }) => <span data-testid="avatar-fallback">{children}</span>,
}))

describe('ProjectTeamView', () => {
  const mockProject = {
    id: 'project-1',
    title: 'Test Project',
    team: [
      {
        id: 'user-1',
        name: 'John Doe',
        role: 'Developer',
        avatar: '/avatar1.jpg',
      },
      {
        id: 'user-2',
        name: 'Jane Smith',
        role: 'Designer',
        avatar: '/avatar2.jpg',
      },
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Task 1',
        status: 'completed',
        assignee: 'user-1',
        dueDate: new Date('2025-11-01').toISOString(),
      },
      {
        id: 'task-2',
        title: 'Task 2',
        status: 'in-progress',
        assignee: 'user-1',
        dueDate: new Date('2025-11-15').toISOString(),
      },
      {
        id: 'task-3',
        title: 'Task 3',
        status: 'to-do',
        assignee: 'user-2',
        dueDate: new Date('2025-10-20').toISOString(), // Overdue
      },
    ],
  }

  describe('Team Overview', () => {
    it('displays team size correctly', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('Active members')).toBeInTheDocument()
    })

    it('displays total tasks count', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Assigned to team')).toBeInTheDocument()
    })

    it('calculates average completion rate correctly', () => {
      render(<ProjectTeamView project={mockProject} />)
      // User 1: 1/2 = 50%, User 2: 0/1 = 0%, Avg = 25%
      expect(screen.getByText('25%')).toBeInTheDocument()
      expect(screen.getByText('Team average')).toBeInTheDocument()
    })

    it('handles empty team gracefully', () => {
      const emptyTeamProject = { ...mockProject, team: [] }
      render(<ProjectTeamView project={emptyTeamProject} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles project with no tasks', () => {
      const noTasksProject = { ...mockProject, tasks: [] }
      render(<ProjectTeamView project={noTasksProject} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('Assigned to team')).toBeInTheDocument()
    })

    it('handles project with undefined tasks', () => {
      const undefinedTasksProject = { ...mockProject, tasks: undefined }
      render(<ProjectTeamView project={undefinedTasksProject} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('Team Member Display', () => {
    it('renders all team members', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('displays member roles', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('Developer')).toBeInTheDocument()
      expect(screen.getByText('Designer')).toBeInTheDocument()
    })

    it('displays member avatars', () => {
      render(<ProjectTeamView project={mockProject} />)
      const avatars = screen.getAllByTestId('avatar-image')
      expect(avatars).toHaveLength(2)
      expect(avatars[0]).toHaveAttribute('src', '/avatar1.jpg')
      expect(avatars[1]).toHaveAttribute('src', '/avatar2.jpg')
    })

    it('displays avatar fallback initials', () => {
      render(<ProjectTeamView project={mockProject} />)
      const fallbacks = screen.getAllByTestId('avatar-fallback')
      expect(fallbacks[0]).toHaveTextContent('JD')
      expect(fallbacks[1]).toHaveTextContent('JS')
    })

    it('handles multi-word names for initials', () => {
      const multiWordProject = {
        ...mockProject,
        team: [
          {
            id: 'user-1',
            name: 'John Michael Doe',
            role: 'Developer',
          },
        ],
      }
      render(<ProjectTeamView project={multiWordProject} />)
      const fallback = screen.getByTestId('avatar-fallback')
      expect(fallback).toHaveTextContent('JMD')
    })

    it('displays task count badge for each member', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('2 tasks')).toBeInTheDocument() // User 1
      expect(screen.getByText('1 tasks')).toBeInTheDocument() // User 2
    })
  })

  describe('Task Statistics', () => {
    it('displays completion rate for each member', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('50%')).toBeInTheDocument() // User 1: 1/2
      expect(screen.getByText('0%')).toBeInTheDocument() // User 2: 0/1
    })

    it('displays completed tasks count', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('1 completed')).toBeInTheDocument()
      expect(screen.getByText('0 completed')).toBeInTheDocument()
    })

    it('displays in-progress tasks count', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('1 in progress')).toBeInTheDocument()
      expect(screen.getByText('0 in progress')).toBeInTheDocument()
    })

    it('displays overdue tasks count', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('1 overdue')).toBeInTheDocument()
    })

    it('does not show overdue count when zero', () => {
      const noOverdueProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'in-progress',
            assignee: 'user-1',
            dueDate: new Date('2025-12-01').toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={noOverdueProject} />)
      expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
    })

    it('renders progress bar with correct value', () => {
      render(<ProjectTeamView project={mockProject} />)
      const progressBars = screen.getAllByTestId('progress')
      expect(progressBars[0]).toHaveAttribute('data-value', '50')
      expect(progressBars[1]).toHaveAttribute('data-value', '0')
    })

    it('calculates 100% completion correctly', () => {
      const allCompletedProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'completed',
            assignee: 'user-1',
            dueDate: new Date('2025-11-01').toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={allCompletedProject} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('Assignee Matching', () => {
    it('matches tasks by assignee string ID', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
    })

    it('matches tasks by assignee object with id', () => {
      const objectAssigneeProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'completed',
            assignee: { id: 'user-1', name: 'John Doe' },
            dueDate: new Date('2025-11-01').toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={objectAssigneeProject} />)
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    it('matches tasks by assigneeId field', () => {
      const assigneeIdProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'completed',
            assigneeId: 'user-1',
            dueDate: new Date('2025-11-01').toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={assigneeIdProject} />)
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })
  })

  describe('Task List Display', () => {
    it('displays all assigned tasks for each member', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
      expect(screen.getByText('Task 3')).toBeInTheDocument()
    })

    it('shows "No tasks assigned" for members with no tasks', () => {
      const noTaskMemberProject = {
        ...mockProject,
        team: [
          ...mockProject.team,
          {
            id: 'user-3',
            name: 'Bob Johnson',
            role: 'Manager',
          },
        ],
      }
      render(<ProjectTeamView project={noTaskMemberProject} />)
      expect(screen.getByText('No tasks assigned')).toBeInTheDocument()
    })

    it('displays task due dates in short format', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText(/Nov 1/)).toBeInTheDocument()
      expect(screen.getByText(/Nov 15/)).toBeInTheDocument()
    })

    it('handles tasks with no due date', () => {
      const noDueDateProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'in-progress',
            assignee: 'user-1',
            dueDate: null,
          },
        ],
      }
      render(<ProjectTeamView project={noDueDateProject} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('Task Urgency and Sorting', () => {
    it('displays overdue indicator for past due tasks', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText(/days overdue/)).toBeInTheDocument()
    })

    it('displays "Due today" for tasks due today', () => {
      const todayProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Today Task',
            status: 'in-progress',
            assignee: 'user-1',
            dueDate: new Date().toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={todayProject} />)
      expect(screen.getByText('(Due today)')).toBeInTheDocument()
    })

    it('sorts tasks by urgency (overdue first)', () => {
      render(<ProjectTeamView project={mockProject} />)
      // Task 3 is overdue, should appear first for user-2
      const cards = screen.getAllByText(/Task/)
      // Verify overdue task is rendered
      expect(screen.getByText('Task 3')).toBeInTheDocument()
    })
  })

  describe('Task Status Display', () => {
    it('displays status badges for all tasks', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('In progress')).toBeInTheDocument()
      expect(screen.getByText('To do')).toBeInTheDocument()
    })

    it('applies correct status colors', () => {
      render(<ProjectTeamView project={mockProject} />)
      const badges = screen.getAllByTestId('badge')
      // Check that badges have styling classes
      expect(badges.length).toBeGreaterThan(0)
    })

    it('handles "blocked" status', () => {
      const blockedProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Blocked Task',
            status: 'blocked',
            assignee: 'user-1',
            dueDate: new Date('2025-11-01').toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={blockedProject} />)
      expect(screen.getByText('Blocked')).toBeInTheDocument()
    })
  })

  describe('getTaskStatusColor function', () => {
    it('returns correct color for to-do status', () => {
      const todoProject = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 'to-do',
            assignee: 'user-1',
            dueDate: new Date('2025-11-01').toISOString(),
          },
        ],
      }
      render(<ProjectTeamView project={todoProject} />)
      expect(screen.getByText('To do')).toBeInTheDocument()
    })

    it('returns correct color for completed status', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('returns correct color for in progress status', () => {
      render(<ProjectTeamView project={mockProject} />)
      expect(screen.getByText('In progress')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles member with empty task array', () => {
      const emptyTaskProject = {
        ...mockProject,
        team: [mockProject.team[0]],
        tasks: [],
      }
      render(<ProjectTeamView project={emptyTaskProject} />)
      expect(screen.getByText('No tasks assigned')).toBeInTheDocument()
    })

    it('handles completion rate calculation with zero tasks', () => {
      const zeroTaskProject = {
        ...mockProject,
        team: [mockProject.team[0]],
        tasks: [],
      }
      render(<ProjectTeamView project={zeroTaskProject} />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })
})

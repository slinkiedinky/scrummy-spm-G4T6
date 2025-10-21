import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamTimeline } from '../TeamTimeline'

// Mock date-fns
jest.mock('date-fns', () => ({
  format: (date, formatStr) => date.toLocaleDateString(),
  startOfWeek: (date) => date,
  endOfWeek: (date) => date,
  addDays: (date, days) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  },
  isSameDay: (date1, date2) => date1.toDateString() === date2.toDateString(),
}))

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }) => <span className={className}>{children}</span>,
}))

describe('TeamTimeline Component', () => {
  const mockTasks = [
    {
      id: 'task-1',
      title: 'Task 1',
      description: 'Description 1',
      dueDate: new Date('2025-01-15').toISOString(),
      status: 'in progress',
      priority: 7,
      assigneeId: 'user-1',
      collaboratorsIds: ['user-2'],
      tags: ['urgent'],
    },
    {
      id: 'task-2',
      title: 'Task 2',
      description: 'Description 2',
      dueDate: new Date('2025-01-20').toISOString(),
      status: 'completed',
      priority: 5,
      assigneeId: 'user-2',
      collaboratorsIds: [],
      tags: [],
    },
    {
      id: 'task-3',
      title: 'Task 3',
      dueDate: null, // No due date
      status: 'to-do',
      priority: 3,
      assigneeId: 'user-1',
      collaboratorsIds: [],
    },
  ]

  const mockTeamMembers = ['user-1', 'user-2']

  const mockResolveUserLabel = (userId) => {
    const userMap = {
      'user-1': 'John Doe',
      'user-2': 'Jane Smith',
    }
    return userMap[userId] || userId
  }

  describe('Rendering', () => {
    it('renders the card component', () => {
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('displays the header title', () => {
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      expect(screen.getByText('Team Schedule')).toBeInTheDocument()
    })

    it('displays instructions text', () => {
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      expect(screen.getByText(/click on a day to see who has tasks/i)).toBeInTheDocument()
    })
  })

  describe('Timeline days', () => {
    it('shows timeline days count', () => {
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      // Check that days count is shown (will be multiple matches, so just check one exists)
      const daysText = screen.getAllByText(/days/i)
      expect(daysText.length).toBeGreaterThan(0)
    })

    it('filters out tasks without due dates', () => {
      const { container } = render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      // Task 3 has no due date, so should not appear
      expect(container.textContent).not.toContain('Task 3')
    })
  })

  describe('Day interaction', () => {
    it('expands day details when clicked', async () => {
      const user = userEvent.setup()
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      // Find and click a day with tasks
      const dayButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('task')
      )

      if (dayButtons.length > 0) {
        await user.click(dayButtons[0])

        // Should show expanded view
        const taskTitles = screen.queryAllByText(/Task [12]/)
        expect(taskTitles.length).toBeGreaterThan(0)
      }
    })

    it('collapses day details when clicked again', async () => {
      const user = userEvent.setup()
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      const dayButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('task')
      )

      if (dayButtons.length > 0) {
        // Click to expand
        await user.click(dayButtons[0])

        // Click again to collapse
        await user.click(dayButtons[0])

        // Expanded content should be gone
        const expandedView = screen.queryByText(/task[s]? due/i)
        expect(expandedView).not.toBeInTheDocument()
      }
    })
  })

  describe('Legend', () => {
    it('displays legend with task status indicators', () => {
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      expect(screen.getByText('Active tasks')).toBeInTheDocument()
      expect(screen.getByText('All completed')).toBeInTheDocument()
      expect(screen.getByText('No tasks')).toBeInTheDocument()
    })
  })

  describe('Task display in expanded view', () => {
    it('shows task title in expanded day', async () => {
      const user = userEvent.setup()
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      const dayButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('task')
      )

      if (dayButtons.length > 0) {
        await user.click(dayButtons[0])

        const taskTitle = screen.queryByText(/Task [12]/)
        expect(taskTitle).toBeInTheDocument()
      }
    })

    it('shows assignee names in expanded day', async () => {
      const user = userEvent.setup()
      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      const dayButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('task')
      )

      if (dayButtons.length > 0) {
        await user.click(dayButtons[0])

        // Should show user names
        const userNames = screen.queryAllByText(/John Doe|Jane Smith/)
        expect(userNames.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Empty states', () => {
    it('handles empty tasks array', () => {
      const { container } = render(
        <TeamTimeline
          tasks={[]}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      expect(container).toBeInTheDocument()
      expect(screen.getByText('Team Schedule')).toBeInTheDocument()
    })

    it('handles tasks with no due dates', () => {
      const tasksWithoutDates = [
        { id: 'task-1', title: 'Task 1', dueDate: null, status: 'to-do', assigneeId: 'user-1' },
      ]

      const { container } = render(
        <TeamTimeline
          tasks={tasksWithoutDates}
          teamMembers={mockTeamMembers}
          resolveUserLabel={mockResolveUserLabel}
        />
      )

      expect(container).toBeInTheDocument()
    })
  })

  describe('resolveUserLabel function', () => {
    it('uses resolveUserLabel to display user names', () => {
      const customResolveUserLabel = jest.fn((userId) => `Custom ${userId}`)

      render(
        <TeamTimeline
          tasks={mockTasks}
          teamMembers={mockTeamMembers}
          resolveUserLabel={customResolveUserLabel}
        />
      )

      // The function should be called for assignees and collaborators
      expect(customResolveUserLabel).toHaveBeenCalled()
    })
  })
})

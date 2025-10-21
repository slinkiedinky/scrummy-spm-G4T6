import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamCalendar } from '../TeamCalendar'

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }) => (
    <button onClick={onClick} data-variant={variant} data-size={size}>{children}</button>
  ),
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h3>{children}</h3>,
}))

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }) => <div data-testid="avatar">{children}</div>,
  AvatarImage: ({ src, alt }) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }) => <span>{children}</span>,
}))

// Mock lucide icons
jest.mock('lucide-react', () => ({
  ChevronLeft: () => <span>ChevronLeft</span>,
  ChevronRight: () => <span>ChevronRight</span>,
  ArrowLeft: () => <span>ArrowLeft</span>,
  CalendarIcon: () => <span>CalendarIcon</span>,
  User: () => <span>User</span>,
  Mail: () => <span>Mail</span>,
  Clock: () => <span>Clock</span>,
}))

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}))

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ fullName: 'Test User', email: 'test@example.com' })
  })),
}))

// Mock TaskDetailModal
jest.mock('../TaskDetailModal', () => ({
  TaskDetailModal: () => <div data-testid="task-detail-modal">Task Detail Modal</div>,
}))

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes) => classes.filter(Boolean).join(' '),
}))

describe('TeamCalendar Component', () => {
  const mockTeamMembers = ['user-1', 'user-2', 'user-3']
  const mockCurrentUser = { uid: 'current-user', email: 'current@example.com' }
  const mockProjectId = 'project-1'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading state', () => {
    it('shows loading message when loading', async () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      expect(screen.getByText('Loading team members...')).toBeInTheDocument()
    })
  })

  describe('Team members grid view', () => {
    it('renders team members cards after loading', async () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        const cards = screen.getAllByTestId('card')
        expect(cards.length).toBeGreaterThan(0)
      })
    })

    it('renders View Schedule button for each member', async () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', { name: /view schedule/i })
        expect(viewButtons.length).toBe(mockTeamMembers.length)
      })
    })

    it('displays avatar for each team member', async () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        const avatars = screen.getAllByTestId('avatar')
        expect(avatars.length).toBeGreaterThanOrEqual(mockTeamMembers.length)
      })
    })
  })

  describe('Schedule view navigation', () => {
    it('switches to schedule view when View Schedule is clicked', async () => {
      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to team/i })).toBeInTheDocument()
      })
    })

    it('shows member name in schedule view header', async () => {
      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      await waitFor(() => {
        expect(screen.getByText(/schedule/i)).toBeInTheDocument()
      })
    })

    it('returns to grid view when Back button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      // Switch to schedule view
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to team/i })).toBeInTheDocument()
      })

      // Click back button
      const backButton = screen.getByRole('button', { name: /back to team/i })
      await user.click(backButton)

      // Should be back in grid view
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /back to team/i })).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })
    })
  })

  describe('Calendar navigation', () => {
    it('renders calendar navigation buttons in schedule view', async () => {
      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
      })
    })

    it('shows current month/year in schedule view', async () => {
      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      await waitFor(() => {
        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        expect(screen.getByText(currentMonth)).toBeInTheDocument()
      })
    })
  })

  describe('Empty state', () => {
    it('handles empty team members array', () => {
      const { container } = render(
        <TeamCalendar
          teamMembers={[]}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      expect(container).toBeInTheDocument()
    })

    it('renders without crashing with empty team members', async () => {
      const { container } = render(
        <TeamCalendar
          teamMembers={[]}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      // Component should render and eventually complete loading
      await waitFor(() => {
        expect(container.firstChild).toBeTruthy()
      })
    })
  })

  describe('Props handling', () => {
    it('accepts currentUser prop', () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      expect(screen.queryByText('Loading team members...')).toBeInTheDocument()
    })

    it('accepts projectId prop', () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      expect(screen.queryByText('Loading team members...')).toBeInTheDocument()
    })

    it('handles missing teamMembers prop with default value', () => {
      const { container } = render(
        <TeamCalendar
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      expect(container).toBeInTheDocument()
    })
  })

  describe('Edge cases and error handling', () => {
    it('handles missing memberId or projectId', async () => {
      const user = userEvent.setup()
      
      // Render with null member ID
      render(
        <TeamCalendar
          teamMembers={[{ id: null, fullName: 'No ID Member' }]}
          currentUser={mockCurrentUser}
          projectId={null}
        />
      )

      expect(screen.getByText('Team Calendar')).toBeInTheDocument()
    })

    it('handles tasks with Firestore timestamp dueDate', async () => {
      const { getDocs } = require('firebase/firestore')
      
      const mockTaskWithTimestamp = {
        id: 'task-timestamp',
        data: () => ({
          title: 'Timestamp Task',
          dueDate: { seconds: 1735689600 }, // Firestore timestamp
          assigneeId: 'member-1',
          status: 'in progress'
        })
      }

      getDocs.mockResolvedValueOnce({
        docs: [mockTaskWithTimestamp]
      })

      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      // Should handle Firestore timestamp without crashing
      await waitFor(() => {
        expect(screen.getByText(/schedule/i)).toBeInTheDocument()
      })
    })

    it('handles tasks with string dueDate', async () => {
      const { getDocs } = require('firebase/firestore')
      
      const mockTaskWithStringDate = {
        id: 'task-string-date',
        data: () => ({
          title: 'String Date Task',
          dueDate: '2025-12-31T23:59:59Z',
          assigneeId: 'member-1',
          status: 'to-do'
        })
      }

      getDocs.mockResolvedValueOnce({
        docs: [mockTaskWithStringDate]
      })

      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      // Should handle string date without crashing
      await waitFor(() => {
        expect(screen.getByText(/schedule/i)).toBeInTheDocument()
      })
    })

    it('handles duplicate task IDs in task map', async () => {
      const { getDocs } = require('firebase/firestore')
      
      const duplicateTask = {
        id: 'duplicate-task',
        data: () => ({
          title: 'Duplicate Task',
          dueDate: '2025-12-31',
          assigneeId: 'member-1',
          status: 'in progress'
        })
      }

      // Return same task twice to test duplicate handling
      getDocs.mockResolvedValueOnce({
        docs: [duplicateTask, duplicateTask]
      })

      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      // Should handle duplicates without crashing
      await waitFor(() => {
        expect(screen.getByText(/schedule/i)).toBeInTheDocument()
      })
    })

    it('handles tasks without dueDate', async () => {
      const { getDocs } = require('firebase/firestore')
      
      const taskWithoutDueDate = {
        id: 'task-no-due-date',
        data: () => ({
          title: 'No Due Date Task',
          assigneeId: 'member-1',
          status: 'to-do'
          // No dueDate field
        })
      }

      getDocs.mockResolvedValueOnce({
        docs: [taskWithoutDueDate]
      })

      const user = userEvent.setup()
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /view schedule/i }).length).toBeGreaterThan(0)
      })

      const viewButton = screen.getAllByRole('button', { name: /view schedule/i })[0]
      await user.click(viewButton)

      // Should handle missing dueDate without crashing
      await waitFor(() => {
        expect(screen.getByText(/schedule/i)).toBeInTheDocument()
      })
    })

    it('handles missing or null projectId', () => {
      render(
        <TeamCalendar
          teamMembers={mockTeamMembers}
          currentUser={mockCurrentUser}
          projectId={null}
        />
      )

      expect(screen.getByText('Team Calendar')).toBeInTheDocument()
    })

    it('handles missing or null memberId in team members', () => {
      const teamMembersWithNullId = [
        { id: null, fullName: 'Member With Null ID' },
        { id: '', fullName: 'Member With Empty ID' },
        ...mockTeamMembers
      ]

      render(
        <TeamCalendar
          teamMembers={teamMembersWithNullId}
          currentUser={mockCurrentUser}
          projectId={mockProjectId}
        />
      )

      expect(screen.getByText('Team Calendar')).toBeInTheDocument()
    })
  })
})

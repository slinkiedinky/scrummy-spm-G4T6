import { render, screen, fireEvent } from '@testing-library/react'
import { TaskColumn } from '../TaskColumnReal'

// Mock dependencies
jest.mock('lucide-react', () => ({
  Calendar: () => <span>Calendar</span>,
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, className }) => (
    <div data-testid="card" onClick={onClick} className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <div data-testid="card-title">{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}))

describe('TaskColumn', () => {
  const mockOnTaskClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockTasks = [
    {
      id: 'task-1',
      title: 'Task 1',
      status: 'in progress',
      priority: 7,
      dueDate: '2025-11-01T00:00:00.000Z',
      assigneeName: 'John Doe',
      collaboratorNames: ['Jane Smith', 'Bob Johnson'],
      createdBy: 'user-1',
      creatorName: 'Alice Admin',
      projectName: 'Project Alpha',
      tags: ['urgent', 'frontend'],
    },
    {
      id: 'task-2',
      title: 'Task 2',
      status: 'to-do',
      priority: 3,
      dueDate: '2025-12-15T00:00:00.000Z',
    },
  ]

  describe('Column Header', () => {
    it('renders column title', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={mockTasks}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('To Do')).toBeInTheDocument()
    })

    it('displays task count badge', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={mockTasks}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('displays color indicator', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={mockTasks}
          onTaskClick={mockOnTaskClick}
        />
      )
      const colorIndicator = document.querySelector('.bg-blue-400')
      expect(colorIndicator).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows "No tasks" when task list is empty', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('No tasks')).toBeInTheDocument()
    })

    it('renders dashed border card for empty state', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const card = screen.getByTestId('card')
      expect(card).toHaveClass('border-dashed')
    })
  })

  describe('Task Cards', () => {
    it('renders all tasks in the column', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={mockTasks}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
    })

    it('renders task title', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })

    it('renders project name when present', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    })

    it('does not render project name when missing', () => {
      const taskWithoutProject = { ...mockTasks[1], projectName: null }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithoutProject]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const projectElements = screen.queryByText(/Project/)
      expect(projectElements).not.toBeInTheDocument()
    })

    it('calls onTaskClick when task card is clicked', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const cards = screen.getAllByTestId('card')
      const taskCard = cards.find((card) => !card.classList.contains('border-dashed'))
      fireEvent.click(taskCard)
      expect(mockOnTaskClick).toHaveBeenCalledWith(mockTasks[0])
    })
  })

  describe('Status Display', () => {
    it('displays "To Do" for to-do status', () => {
      const todoTask = { ...mockTasks[0], status: 'to-do' }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[todoTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('To Do')).toBeInTheDocument()
    })

    it('displays "In Progress" for in progress status', () => {
      render(
        <TaskColumn
          title="In Progress"
          color="bg-yellow-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    it('displays "Blocked" for blocked status', () => {
      const blockedTask = { ...mockTasks[0], status: 'blocked' }
      render(
        <TaskColumn
          title="Blocked"
          color="bg-red-400"
          tasks={[blockedTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Blocked')).toBeInTheDocument()
    })

    it('displays "Completed" for completed status', () => {
      const completedTask = { ...mockTasks[0], status: 'completed' }
      render(
        <TaskColumn
          title="Completed"
          color="bg-green-400"
          tasks={[completedTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
  })

  describe('Priority Display', () => {
    it('displays priority badge', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Priority 7')).toBeInTheDocument()
    })

    it('handles high priority (>= 8)', () => {
      const highPriorityTask = { ...mockTasks[0], priority: 9 }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[highPriorityTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Priority 9')).toBeInTheDocument()
    })

    it('handles low priority (< 4)', () => {
      const lowPriorityTask = { ...mockTasks[0], priority: 2 }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[lowPriorityTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Priority 2')).toBeInTheDocument()
    })

    it('handles medium priority (4-7)', () => {
      const mediumPriorityTask = { ...mockTasks[0], priority: 5 }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mediumPriorityTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('Priority 5')).toBeInTheDocument()
    })

    it('applies correct color class for high priority', () => {
      const highPriorityTask = { ...mockTasks[0], priority: 9 }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[highPriorityTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const badge = screen.getByText('Priority 9')
      expect(badge).toHaveClass('bg-red-100')
    })

    it('applies correct color class for medium priority', () => {
      const mediumPriorityTask = { ...mockTasks[0], priority: 5 }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mediumPriorityTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const badge = screen.getByText('Priority 5')
      expect(badge).toHaveClass('bg-white')
    })

    it('applies correct color class for low priority', () => {
      const lowPriorityTask = { ...mockTasks[0], priority: 2 }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[lowPriorityTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const badge = screen.getByText('Priority 2')
      expect(badge).toHaveClass('bg-emerald-100')
    })
  })

  describe('Tags Display', () => {
    it('displays task tags when present', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('urgent')).toBeInTheDocument()
      expect(screen.getByText('frontend')).toBeInTheDocument()
    })

    it('does not render tags section when tags array is empty', () => {
      const noTagsTask = { ...mockTasks[0], tags: [] }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[noTagsTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      // Tags should not be rendered
      const cardContent = screen.getByTestId('card-content')
      expect(cardContent).not.toHaveTextContent('urgent')
    })

    it('does not render tags section when tags is undefined', () => {
      const noTagsTask = { ...mockTasks[0], tags: undefined }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[noTagsTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const cardContent = screen.getByTestId('card-content')
      expect(cardContent).not.toHaveTextContent('urgent')
    })
  })

  describe('Assignee Display', () => {
    it('displays assignee name from assigneeName', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Assignee: John Doe/)).toBeInTheDocument()
    })

    it('displays assignee name from assignee object', () => {
      const taskWithAssigneeObject = {
        ...mockTasks[0],
        assignee: { id: 'user-1', name: 'Jane Doe' },
        assigneeName: undefined,
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithAssigneeObject]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Assignee: Jane Doe/)).toBeInTheDocument()
    })

    it('displays assignee name from assigneeSummary', () => {
      const taskWithSummary = {
        ...mockTasks[0],
        assignee: null,
        assigneeName: null,
        assigneeSummary: { name: 'Bob Smith' },
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithSummary]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Assignee: Bob Smith/)).toBeInTheDocument()
    })

    it('does not render assignee section when no assignee', () => {
      const noAssigneeTask = {
        ...mockTasks[0],
        assignee: null,
        assigneeName: null,
        assigneeSummary: null,
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[noAssigneeTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.queryByText(/Assignee:/)).not.toBeInTheDocument()
    })
  })

  describe('Collaborators Display', () => {
    it('displays collaborator names from collaboratorNames array', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Collaborators: Jane Smith, Bob Johnson/)).toBeInTheDocument()
    })

    it('displays collaborator names from collaborators object array', () => {
      const taskWithCollaboratorObjects = {
        ...mockTasks[0],
        collaboratorNames: undefined,
        collaborators: [
          { id: 'user-1', name: 'Alice' },
          { id: 'user-2', name: 'Charlie' },
        ],
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithCollaboratorObjects]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Collaborators: Alice, Charlie/)).toBeInTheDocument()
    })

    it('filters out null/undefined collaborator names', () => {
      const taskWithMixedCollaborators = {
        ...mockTasks[0],
        collaboratorNames: undefined,
        collaborators: [
          { id: 'user-1', name: 'Alice' },
          { id: 'user-2' }, // No name
          null,
          { id: 'user-3', name: 'Bob' },
        ],
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithMixedCollaborators]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Collaborators: Alice, Bob/)).toBeInTheDocument()
    })

    it('does not render collaborators section when no collaborators', () => {
      const noCollaboratorsTask = {
        ...mockTasks[0],
        collaboratorNames: undefined,
        collaborators: [],
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[noCollaboratorsTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.queryByText(/Collaborators:/)).not.toBeInTheDocument()
    })
  })

  describe('Creator Display', () => {
    it('displays creator name from creatorName', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Created by: Alice Admin/)).toBeInTheDocument()
    })

    it('displays creator name from creatorSummary', () => {
      const taskWithCreatorSummary = {
        ...mockTasks[0],
        creatorName: undefined,
        creatorSummary: { name: 'Admin User' },
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithCreatorSummary]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Created by: Admin User/)).toBeInTheDocument()
    })

    it('displays truncated user ID when no creator name', () => {
      const taskWithOnlyId = {
        ...mockTasks[0],
        createdBy: 'user-12345',
        creatorName: undefined,
        creatorSummary: undefined,
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithOnlyId]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/Created by: User user/)).toBeInTheDocument()
    })

    it('does not render creator section when no creator info', () => {
      const noCreatorTask = {
        ...mockTasks[0],
        createdBy: null,
        creatorName: null,
        creatorSummary: null,
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[noCreatorTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.queryByText(/Created by:/)).not.toBeInTheDocument()
    })
  })

  describe('Due Date Display', () => {
    it('displays formatted due date', () => {
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      // Date should be formatted to local string
      expect(screen.getByText(/11\/1\/2025/)).toBeInTheDocument()
    })

    it('handles due date as string', () => {
      const taskWithStringDate = {
        ...mockTasks[0],
        dueDate: '2025-11-01',
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithStringDate]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/11\/1\/2025/)).toBeInTheDocument()
    })

    it('handles due date as Date object', () => {
      const taskWithDateObject = {
        ...mockTasks[0],
        dueDate: new Date('2025-11-01'),
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithDateObject]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText(/11\/1\/2025/)).toBeInTheDocument()
    })

    it('handles due date as Firestore timestamp', () => {
      const taskWithTimestamp = {
        ...mockTasks[0],
        dueDate: { seconds: 1730419200 }, // Nov 1, 2025
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[taskWithTimestamp]}
          onTaskClick={mockOnTaskClick}
        />
      )
      // Should convert seconds to date
      expect(screen.getByText(/11\/1\/2025/)).toBeInTheDocument()
    })

    it('displays em dash when no due date', () => {
      const noDueDateTask = {
        ...mockTasks[0],
        dueDate: null,
      }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[noDueDateTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('Status Color Application', () => {
    it('applies correct styling for to-do status', () => {
      const todoTask = { ...mockTasks[0], status: 'to-do' }
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={[todoTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const statusBadge = screen.getByText('To Do')
      expect(statusBadge).toHaveClass('bg-gray-100')
    })

    it('applies correct styling for in progress status', () => {
      render(
        <TaskColumn
          title="In Progress"
          color="bg-yellow-400"
          tasks={[mockTasks[0]]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const statusBadge = screen.getByText('In Progress')
      expect(statusBadge).toHaveClass('bg-blue-100')
    })

    it('applies correct styling for completed status', () => {
      const completedTask = { ...mockTasks[0], status: 'completed' }
      render(
        <TaskColumn
          title="Completed"
          color="bg-green-400"
          tasks={[completedTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const statusBadge = screen.getByText('Completed')
      expect(statusBadge).toHaveClass('bg-emerald-100')
    })

    it('applies correct styling for blocked status', () => {
      const blockedTask = { ...mockTasks[0], status: 'blocked' }
      render(
        <TaskColumn
          title="Blocked"
          color="bg-red-400"
          tasks={[blockedTask]}
          onTaskClick={mockOnTaskClick}
        />
      )
      const statusBadge = screen.getByText('Blocked')
      expect(statusBadge).toHaveClass('bg-red-100')
    })
  })

  describe('Console Logging', () => {
    it('logs task information to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      render(
        <TaskColumn
          title="To Do"
          color="bg-blue-400"
          tasks={mockTasks}
          onTaskClick={mockOnTaskClick}
        />
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        'Tasks in column:',
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Task 1',
            createdBy: 'user-1',
            creatorName: 'Alice Admin',
          }),
        ])
      )
      consoleSpy.mockRestore()
    })
  })
})

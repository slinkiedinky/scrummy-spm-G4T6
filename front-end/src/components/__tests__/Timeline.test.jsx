import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Timeline from '../Timeline'

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user' },
  },
  db: {},
}))

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth, callback) => {
    callback({ uid: 'test-user' })
    return jest.fn() // unsubscribe function
  },
}))

jest.mock('firebase/firestore', () => ({
  collectionGroup: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ fullName: 'Test User', email: 'test@example.com' })
  })),
}))

// Mock API
jest.mock('@/lib/api', () => ({
  listAssignedTasks: jest.fn(() => Promise.resolve([
    {
      id: 'task-1',
      title: 'Test Task 1',
      projectId: 'project-1',
      projectName: 'Project A',
      dueDate: '2025-12-31',
      status: 'in progress',
      priority: 7,
      createdBy: 'user-1',
      updatedAt: '2025-01-15',
    },
    {
      id: 'task-2',
      title: 'Test Task 2',
      projectId: 'project-1',
      projectName: 'Project A',
      dueDate: '2025-11-15',
      status: 'to-do',
      priority: 5,
      ownerId: 'user-2',
      updatedAt: '2025-01-10',
    },
  ])),
}))

describe('Timeline Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Edge cases and error handling', () => {
    it('handles permission denied errors', async () => {
      const mockError = new Error('Permission denied')
      mockError.code = 'permission-denied'
      
      const { getDocs } = require('firebase/firestore')
      getDocs.mockRejectedValueOnce(mockError)

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument()
      })
    })

    it('handles tasks with null values', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-null',
          title: 'Task with nulls',
          projectId: null,
          projectName: null,
          dueDate: null,
          status: 'to-do',
          priority: null,
          createdBy: null,
          updatedAt: null,
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Task with nulls')).toBeInTheDocument()
      })
    })

    it('handles tasks with string priority', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-string-priority',
          title: 'String Priority Task',
          priority: "high-priority-task-5",
          status: 'in progress',
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('String Priority Task')).toBeInTheDocument()
      })
    })

    it('handles invalid priority values', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-invalid-priority',
          title: 'Invalid Priority Task',
          priority: 0, // Invalid (< 1)
          status: 'to-do',
        },
        {
          id: 'task-high-priority',
          title: 'High Priority Task',
          priority: 15, // Invalid (> 10)
          status: 'to-do',
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Invalid Priority Task')).toBeInTheDocument()
        expect(screen.getByText('High Priority Task')).toBeInTheDocument()
      })
    })

    it('handles high priority tasks (>= 8)', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-high-priority',
          title: 'High Priority Task',
          priority: 9,
          status: 'to-do',
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('High Priority Task')).toBeInTheDocument()
      })
    })

    it('handles medium priority tasks (>= 4)', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-medium-priority',
          title: 'Medium Priority Task',
          priority: 6,
          status: 'to-do',
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Medium Priority Task')).toBeInTheDocument()
      })
    })

    it('handles blocked status tasks', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-blocked',
          title: 'Blocked Task',
          status: 'blocked',
          priority: 5,
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Blocked Task')).toBeInTheDocument()
      })
    })

    it('handles completed tasks', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-completed',
          title: 'Completed Task',
          status: 'completed',
          statusLabel: 'Completed',
          priority: 5,
        }
      ])
      
      render(<Timeline />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading your timeline…')).not.toBeInTheDocument()
      })
      
      // Expect that completed tasks are filtered out
      expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
      expect(screen.getByText('No task available')).toBeInTheDocument()
    })

    it('handles tasks without assigned user ID', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      
      // Mock a task without createdBy/ownerId field
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-1',
          title: 'Task Without User ID',
          status: 'to-do',
          statusLabel: 'To Do',
          priority: 5,
          projectId: 'project-1',
          projectName: 'Test Project',
          dueDate: new Date('2024-12-01'),
          updatedAt: new Date('2024-11-01'),
          // No createdBy or ownerId field
        }
      ])
      
      render(<Timeline />)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading your timeline…')).not.toBeInTheDocument()
      })
      
      // Task should be displayed
      expect(screen.getByText('Task Without User ID')).toBeInTheDocument()
      expect(screen.getByText('Test Project')).toBeInTheDocument()
      
      // Should show "—" for missing Assigned by
      expect(screen.getByText(/Assigned by:/)).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('handles empty date formatting', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-no-date',
          title: 'Task without date',
          dueDate: '',
          updatedAt: '',
          status: 'to-do',
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Task without date')).toBeInTheDocument()
      })
    })

    it('handles alternative task creator field (ownerId vs createdBy)', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'task-owner',
          title: 'Task with ownerId',
          ownerId: 'owner-1',
          status: 'to-do',
        }
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Task with ownerId')).toBeInTheDocument()
      })
    })
  })

  describe('Rendering', () => {
    it('renders the timeline header', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Timeline')).toBeInTheDocument()
      })
    })

    it('displays the description text', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText(/chronological task timeline/i)).toBeInTheDocument()
      })
    })

    it('renders Clear filters button', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
      })
    })

    it('renders Refresh button', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })
    })
  })

  describe('Filter dropdowns', () => {
    it('renders Project filter dropdown', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Project')).toBeInTheDocument()
      })
    })

    it('renders Priority filter dropdown', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Priority')).toBeInTheDocument()
      })
    })

    it('renders Status filter dropdown', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('shows loading message initially', () => {
      render(<Timeline />)

      expect(screen.getByText(/loading your timeline/i)).toBeInTheDocument()
    })

    it('hides loading message after data loads', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.queryByText(/loading your timeline/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Tasks display', () => {
    it('displays task titles', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument()
        expect(screen.getByText('Test Task 2')).toBeInTheDocument()
      })
    })

    it('displays project names', async () => {
      render(<Timeline />)

      await waitFor(() => {
        const projectLabels = screen.getAllByText(/Project A/)
        expect(projectLabels.length).toBeGreaterThan(0)
      })
    })

    it('displays priority labels', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Priority 7')).toBeInTheDocument()
        expect(screen.getByText('Priority 5')).toBeInTheDocument()
      })
    })

    it('displays status labels', async () => {
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument()
        expect(screen.getByText('To Do')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    it('clears all filters when Clear filters button is clicked', async () => {
      const user = userEvent.setup()
      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
      })

      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      await user.click(clearButton)

      // After clearing, all tasks should be visible (not filtered out)
      await waitFor(() => {
        expect(screen.getByText('Test Task 1')).toBeInTheDocument()
        expect(screen.getByText('Test Task 2')).toBeInTheDocument()
      })
    })
  })

  describe('Completed tasks filtering', () => {
    it('hides completed tasks by default', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([
        {
          id: 'completed-task',
          title: 'Completed Task',
          projectId: 'project-1',
          projectName: 'Project A',
          dueDate: '2025-01-01',
          status: 'completed',
          priority: 5,
          createdBy: 'user-1',
        },
      ])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
      })
    })
  })

  describe('Empty state', () => {
    it('shows "No task available" when no tasks match filters', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockResolvedValueOnce([])

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('No task available')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('displays error message when loading fails', async () => {
      const { listAssignedTasks } = require('@/lib/api')
      listAssignedTasks.mockRejectedValueOnce(new Error('Failed to load'))

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
      })
    })
  })

  describe('User authentication', () => {
    it('renders component with authenticated user', async () => {
      // The mock at the top of the file provides a logged in user
      render(<Timeline />)

      await waitFor(() => {
        // Component should render with authenticated user (test passes if no error)
        expect(screen.getByText('Timeline')).toBeInTheDocument()
      })
    })
  })

  describe('Task grouping by date', () => {
    it('groups tasks by due date', async () => {
      render(<Timeline />)

      await waitFor(() => {
        // Tasks should be displayed, grouped by date
        expect(screen.getByText('Test Task 1')).toBeInTheDocument()
        expect(screen.getByText('Test Task 2')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh functionality', () => {
    it('reloads the page when Refresh button is clicked', async () => {
      const user = userEvent.setup()
      const originalLocation = window.location
      delete window.location
      window.location = { reload: jest.fn() }

      render(<Timeline />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      expect(window.location.reload).toHaveBeenCalled()

      window.location = originalLocation
    })
  })
})

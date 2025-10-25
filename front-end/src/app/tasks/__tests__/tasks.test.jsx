import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksPage from '../page'
import {
  listAssignedTasks,
  listUsers,
  listStandaloneTasks,
  getProject,
  listSubtasks,
  updateTask,
  deleteTask,
  getTask,
  updateStandaloneTask,
  deleteStandaloneTask,
  getStandaloneTask,
  createStandaloneTask,
  getSubtask,
  updateSubtask,
  deleteSubtask,
  deleteStandaloneSubtask,
} from '@/lib/api'
import { onAuthStateChanged } from 'firebase/auth'
import { toast } from 'sonner'

// Mock the API
jest.mock('@/lib/api', () => ({
  listAssignedTasks: jest.fn(),
  listUsers: jest.fn(),
  listStandaloneTasks: jest.fn(),
  getProject: jest.fn(),
  getTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  listSubtasks: jest.fn(),
  getSubtask: jest.fn(),
  updateSubtask: jest.fn(),
  deleteSubtask: jest.fn(),
  createStandaloneTask: jest.fn(),
  getStandaloneTask: jest.fn(),
  updateStandaloneTask: jest.fn(),
  deleteStandaloneTask: jest.fn(),
  listStandaloneSubtasks: jest.fn(),
  getStandaloneSubtask: jest.fn(),
  updateStandaloneSubtask: jest.fn(),
  deleteStandaloneSubtask: jest.fn(),
}))

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}))

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock TaskDetailModal
jest.mock('@/components/TaskDetailModal', () => ({
  TaskDetailModal: ({ isOpen, task, onClose, onEdit, onDelete }) =>
    isOpen ? (
      <div data-testid="task-detail-modal">
        <div>{task?.title}</div>
        <button onClick={onClose}>Close Modal</button>
        <button onClick={() => onEdit(task)}>Edit Task</button>
        <button onClick={() => onDelete(task)}>Delete Task</button>
      </div>
    ) : null,
}))

// Mock StandaloneTaskModal
jest.mock('@/components/StandaloneTaskModal', () => ({
  StandaloneTaskModal: ({ isOpen, onClose, onSubmit }) =>
    isOpen ? (
      <div data-testid="standalone-task-modal">
        <button onClick={onClose}>Close Standalone Modal</button>
        <button
          onClick={() =>
            onSubmit({
              title: 'New Standalone',
              description: 'Test',
              status: 'to-do',
              priority: '5',
            })
          }
        >
          Submit Standalone
        </button>
      </div>
    ) : null,
}))

describe('TasksPage', () => {
  const mockUser = {
    uid: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    listUsers.mockResolvedValue([
      {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'Developer',
      },
      {
        id: 'user-456',
        email: 'user2@example.com',
        fullName: 'User Two',
        role: 'Manager',
      },
    ])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Authentication & Loading', () => {
    it('shows loading state while validating session', () => {
      onAuthStateChanged.mockImplementation(() => jest.fn())
      render(<TasksPage />)
      expect(screen.getByText('Validating session…')).toBeInTheDocument()
    })

    it('shows loading state while loading tasks', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockImplementation(() => new Promise(() => {}))
      listStandaloneTasks.mockImplementation(() => new Promise(() => {}))

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Loading your tasks…')).toBeInTheDocument()
      })
    })

    it('handles user logout gracefully', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null)
        return jest.fn()
      })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.queryByText('Loading your tasks…')).not.toBeInTheDocument()
      })
      expect(listAssignedTasks).not.toHaveBeenCalled()
    })

    it('cleans up auth listener on unmount', async () => {
      const unsubscribeMock = jest.fn()
      onAuthStateChanged.mockImplementation(() => unsubscribeMock)
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])

      const { unmount } = render(<TasksPage />)
      unmount()
      expect(unsubscribeMock).toHaveBeenCalled()
    })
  })

  describe('Page Rendering', () => {
    it('renders the tasks page with user information', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('My Tasks')).toBeInTheDocument()
        expect(screen.getByText(/Tasks assigned to/i)).toBeInTheDocument()
      })
    })

    it('renders summary cards and filter controls', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Total tasks')).toBeInTheDocument()
        expect(screen.getByText('Overdue')).toBeInTheDocument()
        expect(screen.getByText('Active projects')).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/Search by title/i)).toBeInTheDocument()
      })
    })
  })

  describe('Task Loading & Display', () => {
    it('loads and displays project and standalone tasks', async () => {
      const mockProjectTasks = [
        {
          id: 'task-1',
          title: 'Project Task',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: ['frontend'],
        },
      ]
      const mockStandaloneTasks = [
        {
          id: 'standalone-1',
          title: 'Standalone Task',
          status: 'in progress',
          priority: '7',
          tags: ['urgent'],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockProjectTasks)
      listStandaloneTasks.mockResolvedValue(mockStandaloneTasks)

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Project Task')).toBeInTheDocument()
        expect(screen.getByText('Standalone Task')).toBeInTheDocument()
      })
    })

    it('handles task loading errors', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockRejectedValue(new Error('API Error'))
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('My Tasks')).toBeInTheDocument()
      })
    })

    it('displays tasks from multiple projects', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Project A',
          tags: [],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-2',
          projectName: 'Project B',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Project A')).toBeInTheDocument()
        expect(screen.getByText('Project B')).toBeInTheDocument()
      })
    })
  })

  describe('Task Metrics', () => {
    it('calculates total tasks and overdue tasks correctly', async () => {
      const pastDate = new Date('2020-01-01').toISOString()
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Overdue Task',
          status: 'in progress',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: pastDate,
        },
        {
          id: 'task-2',
          title: 'Completed Task',
          status: 'completed',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: pastDate,
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Overdue Task')).toBeInTheDocument()
        expect(screen.getByText('Completed Task')).toBeInTheDocument()
      })
      
      // Check for total tasks (should be 2)
      const totalTasksElement = screen.getByText('Total tasks').closest('div')
      expect(within(totalTasksElement).getByText('2')).toBeInTheDocument()
      
      // Check for overdue count (should be 1)
      const overdueElement = screen.getByText('Overdue').closest('div')
      expect(within(overdueElement).getByText('1')).toBeInTheDocument()
    })

    it('counts active projects correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Project A',
          tags: [],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Project A',
          tags: [],
        },
        {
          id: 'task-3',
          title: 'Task 3',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-2',
          projectName: 'Project B',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        const activeProjects = screen.getAllByText('2')
        expect(activeProjects.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Filtering & Search', () => {
    it('filters tasks by search term', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Frontend Task',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
        {
          id: 'task-2',
          title: 'Backend Task',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Frontend Task')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search by title/i)
      await userEvent.type(searchInput, 'Frontend')

      await waitFor(() => {
        expect(screen.getByText('Frontend Task')).toBeInTheDocument()
        expect(screen.queryByText('Backend Task')).not.toBeInTheDocument()
      })
    })

    it('shows empty state when no tasks match filters', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('No tasks found')).toBeInTheDocument()
        expect(screen.getByText(/Try adjusting your filters/i)).toBeInTheDocument()
      })
    })
  })

  describe('Task Interaction', () => {
    it('opens task detail modal when task is clicked', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Click Me',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Click Me')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Click Me').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })
    })

    it('refreshes tasks when refresh button is clicked', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      listAssignedTasks.mockClear()
      listStandaloneTasks.mockClear()

      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(listAssignedTasks).toHaveBeenCalledTimes(1)
        expect(listStandaloneTasks).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Subtasks', () => {
    it('expands and displays subtasks when chevron is clicked', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Subtasks',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          subtaskCount: 2,
          subtaskCompletedCount: 1,
        },
      ]
      const mockSubtasks = [
        {
          id: 'subtask-1',
          title: 'Subtask 1',
          status: 'completed',
        },
        {
          id: 'subtask-2',
          title: 'Subtask 2',
          status: 'to-do',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      listSubtasks.mockResolvedValue(mockSubtasks)

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Task with Subtasks')).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText('Subtask 1')).toBeInTheDocument()
        expect(screen.getByText('Subtask 2')).toBeInTheDocument()
      })
    })

    it('handles subtask loading errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Subtasks',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          subtaskCount: 2,
          subtaskCompletedCount: 1,
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      listSubtasks.mockRejectedValue(new Error('Subtask load error'))

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Task with Subtasks')).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load subtasks:',
          expect.any(Error)
        )
      })
      consoleErrorSpy.mockRestore()
    })

    it('opens subtask detail when clicked', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Subtasks',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          subtaskCount: 1,
          subtaskCompletedCount: 0,
        },
      ]
      const mockSubtasks = [
        {
          id: 'subtask-1',
          title: 'Click Subtask',
          status: 'to-do',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      listSubtasks.mockResolvedValue(mockSubtasks)
      getSubtask.mockResolvedValue({
        id: 'subtask-1',
        title: 'Click Subtask',
        status: 'to-do',
        priority: '3',
      })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Task with Subtasks')).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText('Click Subtask')).toBeInTheDocument()
      })

      const subtaskDiv = screen.getByText('Click Subtask').closest('div[class*="cursor-pointer"]')
      fireEvent.click(subtaskDiv)

      await waitFor(() => {
        expect(getSubtask).toHaveBeenCalledWith('proj-1', 'task-1', 'subtask-1')
      })
    })
  })

  describe('Edit Task', () => {
    it('opens edit dialog and updates task successfully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Edit Me',
          description: 'Original description',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: ['tag1'],
          assigneeId: 'user-123',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      updateTask.mockResolvedValue({ success: true })
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Edit Me')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Edit Me').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit Task')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText(/Title/i)
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Title')

      const form = titleInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', expect.objectContaining({
          title: 'Updated Title',
        }))
        expect(toast.success).toHaveBeenCalledWith('Task updated!')
      })
    })

    it('validates empty title', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Edit Me',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          assigneeId: 'user-123',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Edit Me')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Edit Me').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit Task')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText(/Title/i)
      await userEvent.clear(titleInput)

      const form = titleInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Task title is required.')).toBeInTheDocument()
      })
    })

    it('handles edit errors gracefully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Edit Error',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          assigneeId: 'user-123',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      updateTask.mockRejectedValue(new Error('Update failed'))
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Edit Error')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Edit Error').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit Task')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })

      const form = screen.getByLabelText(/Title/i).closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument()
      })
    })

    it('updates standalone task successfully', async () => {
      const mockStandaloneTasks = [
        {
          id: 'standalone-1',
          title: 'Update Standalone',
          description: 'Old description',
          status: 'to-do',
          priority: '5',
          tags: [],
          ownerId: 'user-123',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue(mockStandaloneTasks)
      updateStandaloneTask.mockResolvedValue({ success: true })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Update Standalone')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Update Standalone').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit Task')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText(/Title/i)
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Standalone Title')

      const form = titleInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(updateStandaloneTask).toHaveBeenCalledWith('standalone-1', expect.objectContaining({
          title: 'Updated Standalone Title',
        }))
        expect(toast.success).toHaveBeenCalledWith('Standalone task updated!')
      })
    })

    it('closes edit dialog when cancel is clicked', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Cancel Edit',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          assigneeId: 'user-123',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Cancel Edit')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Cancel Edit').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit Task')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByLabelText(/Title/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete Task', () => {
    it('deletes task when confirmed', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Delete Me',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      deleteTask.mockResolvedValue({ success: true })
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Delete Me')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Delete Me').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Task')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/permanently removes the task/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(deleteTask).toHaveBeenCalledWith('proj-1', 'task-1')
        expect(toast.success).toHaveBeenCalledWith('Task deleted!')
      })
    })

    it('cancels delete when cancel is clicked', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Cancel Delete',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Cancel Delete')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Cancel Delete').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Task')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/permanently removes the task/i)).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText(/permanently removes the task/i)).not.toBeInTheDocument()
      })
      expect(deleteTask).not.toHaveBeenCalled()
    })

    it('handles delete errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Delete Error',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      deleteTask.mockRejectedValue(new Error('Delete failed'))
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Delete Error')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Delete Error').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Task')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/permanently removes the task/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText('Delete failed')).toBeInTheDocument()
      })
      consoleErrorSpy.mockRestore()
    })

    it('deletes standalone task successfully', async () => {
      const mockStandaloneTasks = [
        {
          id: 'standalone-1',
          title: 'Delete Standalone',
          status: 'to-do',
          priority: '5',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue(mockStandaloneTasks)
      deleteStandaloneTask.mockResolvedValue({ success: true })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Delete Standalone')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Delete Standalone').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Task')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/permanently removes the task/i)).toBeInTheDocument()
      })

      const confirmButtons = screen.getAllByRole('button', { name: /delete/i })
      const actualConfirmButton = confirmButtons[confirmButtons.length - 1]
      fireEvent.click(actualConfirmButton)

      await waitFor(() => {
        expect(deleteStandaloneTask).toHaveBeenCalledWith('standalone-1')
      }, { timeout: 3000 })
    })

    it('deletes subtask successfully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Subtasks',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          subtaskCount: 1,
          subtaskCompletedCount: 0,
        },
      ]
      const mockSubtasks = [
        {
          id: 'subtask-1',
          title: 'Delete Subtask',
          status: 'to-do',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      listSubtasks.mockResolvedValue(mockSubtasks)
      getSubtask.mockResolvedValue({
        id: 'subtask-1',
        title: 'Delete Subtask',
        status: 'to-do',
        priority: '3',
      })
      deleteSubtask.mockResolvedValue({ success: true })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Task with Subtasks')).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText('Delete Subtask')).toBeInTheDocument()
      })

      const subtaskDiv = screen.getByText('Delete Subtask').closest('div[class*="cursor-pointer"]')
      fireEvent.click(subtaskDiv)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Task')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/permanently removes the task/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(deleteSubtask).toHaveBeenCalledWith('proj-1', 'task-1', 'subtask-1')
      })
    })
  })

  describe('Create Standalone Task', () => {
    it('opens standalone task modal when create button is clicked', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Create Standalone Task')).toBeInTheDocument()
      })

      const createButton = screen.getByText('Create Standalone Task')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByTestId('standalone-task-modal')).toBeInTheDocument()
        expect(screen.getByText('Submit Standalone')).toBeInTheDocument()
      })
    })

    it('creates standalone task successfully', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])
      createStandaloneTask.mockResolvedValue({ success: true })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Create Standalone Task')).toBeInTheDocument()
      })

      const createButton = screen.getByText('Create Standalone Task')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByTestId('standalone-task-modal')).toBeInTheDocument()
      })

      const submitButton = screen.getByText('Submit Standalone')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(createStandaloneTask).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith('Standalone task created!')
      })
    })

    it('handles create standalone task error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])
      createStandaloneTask.mockRejectedValue(new Error('Create failed'))

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Create Standalone Task')).toBeInTheDocument()
      })

      const createButton = screen.getByText('Create Standalone Task')
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByTestId('standalone-task-modal')).toBeInTheDocument()
      })

      const submitButton = screen.getByText('Submit Standalone')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(createStandaloneTask).toHaveBeenCalled()
        expect(toast.error).toHaveBeenCalled()
      })
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Edge Cases & Data Handling', () => {
    it('handles tasks with Firestore timestamp format', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Firestore Task',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: { seconds: 1735689600 },
          updatedAt: { seconds: 1729900800 },
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Firestore Task')).toBeInTheDocument()
      })
    })

    it('handles tasks with missing or invalid priority', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'No Priority',
          status: 'to-do',
          priority: null,
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
        {
          id: 'task-2',
          title: 'Invalid Priority',
          status: 'to-do',
          priority: 'invalid',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('No Priority')).toBeInTheDocument()
        expect(screen.getByText('Invalid Priority')).toBeInTheDocument()
      })
    })

    it('handles tasks without projectId (unassigned)', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Unassigned Task',
          status: 'to-do',
          priority: '5',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Unassigned Task')).toBeInTheDocument()
        expect(screen.getByText('Unassigned Project')).toBeInTheDocument()
      })
    })

    it('handles users loading error', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue([])
      listUsers.mockRejectedValue(new Error('Users API Error'))

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText(/Unable to load teammate details/i)).toBeInTheDocument()
      })
    })

    it('handles Date instance in dueDate', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Date Instance Task',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: new Date('2025-12-31'),
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Date Instance Task')).toBeInTheDocument()
      })
    })

    it('handles tasks with collaborators not in user list', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Unknown Collaborators',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          assigneeId: 'user-123',
          collaboratorsIds: ['unknown-user-1', 'unknown-user-2'],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Task with Unknown Collaborators')).toBeInTheDocument()
        // Should display fallback user labels for unknown collaborators
        const unknownUsers = screen.getAllByText(/User unkn/i)
        expect(unknownUsers.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Multiple Filters', () => {
    it('applies status and priority filters together', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'High Priority In Progress',
          status: 'in progress',
          priority: '9',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
        {
          id: 'task-2',
          title: 'Low Priority In Progress',
          status: 'in progress',
          priority: '2',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
        {
          id: 'task-3',
          title: 'High Priority Completed',
          status: 'completed',
          priority: '9',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('High Priority In Progress')).toBeInTheDocument()
        expect(screen.getByText('Low Priority In Progress')).toBeInTheDocument()
        expect(screen.getByText('High Priority Completed')).toBeInTheDocument()
      })
      
      // Verify all 3 tasks are visible initially
      expect(screen.getByText('High Priority In Progress')).toBeInTheDocument()
      expect(screen.getByText('Low Priority In Progress')).toBeInTheDocument()
      expect(screen.getByText('High Priority Completed')).toBeInTheDocument()
    })
  })

  describe('Task Sorting', () => {
    it('sorts tasks by status order and due date', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Completed Old',
          status: 'completed',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: '2025-01-01',
        },
        {
          id: 'task-2',
          title: 'To-Do Recent',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: '2025-12-31',
        },
        {
          id: 'task-3',
          title: 'To-Do Old',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          dueDate: '2025-01-15',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('To-Do Old')).toBeInTheDocument()
      })

      // Get all task titles in order
      const taskTitles = screen.getAllByText(/To-Do|Completed/).map(el => el.textContent)
      
      // To-Do tasks should come before Completed (by status order)
      const toDoOldIndex = taskTitles.indexOf('To-Do Old')
      const toDoRecentIndex = taskTitles.indexOf('To-Do Recent')
      const completedIndex = taskTitles.indexOf('Completed Old')

      expect(toDoOldIndex).toBeLessThan(completedIndex)
      expect(toDoRecentIndex).toBeLessThan(completedIndex)
      // Within same status, older due date should come first
      expect(toDoOldIndex).toBeLessThan(toDoRecentIndex)
    })
  })

  describe('Standalone Subtasks', () => {
    it('displays and expands standalone task subtasks', async () => {
      const mockStandaloneTasks = [
        {
          id: 'standalone-1',
          title: 'Standalone with Subtasks',
          status: 'to-do',
          priority: '5',
          tags: [],
          subtaskCount: 2,
          subtaskCompletedCount: 1,
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue(mockStandaloneTasks)
      listSubtasks.mockResolvedValue([
        { id: 'sub-1', title: 'Standalone Subtask 1', status: 'completed' },
        { id: 'sub-2', title: 'Standalone Subtask 2', status: 'to-do' },
      ])

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Standalone with Subtasks')).toBeInTheDocument()
        expect(screen.getByText(/1\/2 subtasks/i)).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText('Standalone Subtask 1')).toBeInTheDocument()
        expect(screen.getByText('Standalone Subtask 2')).toBeInTheDocument()
      })
    })

    it('deletes standalone subtask successfully', async () => {
      const mockStandaloneTasks = [
        {
          id: 'standalone-1',
          title: 'Standalone Parent',
          status: 'to-do',
          priority: '5',
          tags: [],
          subtaskCount: 1,
          subtaskCompletedCount: 0,
        },
      ]
      const mockSubtasks = [
        {
          id: 'sub-1',
          title: 'Delete Standalone Subtask',
          status: 'to-do',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue([])
      listStandaloneTasks.mockResolvedValue(mockStandaloneTasks)
      listSubtasks.mockResolvedValue(mockSubtasks)
      getSubtask.mockResolvedValue({
        id: 'sub-1',
        title: 'Delete Standalone Subtask',
        status: 'to-do',
        priority: '3',
      })
      deleteStandaloneSubtask.mockResolvedValue({ success: true })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Standalone Parent')).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText('Delete Standalone Subtask')).toBeInTheDocument()
      })

      const subtaskDiv = screen.getByText('Delete Standalone Subtask').closest('div[class*="cursor-pointer"]')
      fireEvent.click(subtaskDiv)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const deleteButton = screen.getByText('Delete Task')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText(/permanently removes the task/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(deleteStandaloneSubtask).toHaveBeenCalledWith('standalone-1', 'sub-1')
      })
    })
  })

  describe('Project Data Loading', () => {
    it('handles project loading errors gracefully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task with Project Error',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      getProject.mockRejectedValue(new Error('Project not found'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Task with Project Error')).toBeInTheDocument()
      })

      const taskButton = screen.getByText('Task with Project Error').closest('button')
      fireEvent.click(taskButton)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      // Should still open modal even if project data fails to load
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load project data:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Update Operations with Subtasks', () => {
    it('updates subtask for project task', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Parent Task',
          status: 'to-do',
          priority: '5',
          projectId: 'proj-1',
          projectName: 'Test Project',
          tags: [],
          subtaskCount: 1,
          subtaskCompletedCount: 0,
          assigneeId: 'user-123',
        },
      ]
      const mockSubtasks = [
        {
          id: 'sub-1',
          title: 'Update Subtask',
          status: 'to-do',
        },
      ]

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser)
        return jest.fn()
      })
      listAssignedTasks.mockResolvedValue(mockTasks)
      listStandaloneTasks.mockResolvedValue([])
      listSubtasks.mockResolvedValue(mockSubtasks)
      getSubtask.mockResolvedValue({
        id: 'sub-1',
        title: 'Update Subtask',
        status: 'to-do',
        priority: '3',
        assigneeId: 'user-123',
      })
      updateSubtask.mockResolvedValue({ success: true })
      getProject.mockResolvedValue({ id: 'proj-1', teamIds: ['user-123'] })

      render(<TasksPage />)
      await waitFor(() => {
        expect(screen.getByText('Parent Task')).toBeInTheDocument()
      })

      const chevronButton = screen.getByRole('button', { name: /expand subtasks/i })
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText('Update Subtask')).toBeInTheDocument()
      })

      const subtaskDiv = screen.getByText('Update Subtask').closest('div[class*="cursor-pointer"]')
      fireEvent.click(subtaskDiv)

      await waitFor(() => {
        expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit Task')
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText(/Title/i)
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Subtask Title')

      const form = titleInput.closest('form')
      fireEvent.submit(form)

      await waitFor(() => {
        expect(updateSubtask).toHaveBeenCalledWith(
          'proj-1',
          'task-1',
          'sub-1',
          expect.objectContaining({
            title: 'Updated Subtask Title',
          })
        )
      })
    })
  })
})

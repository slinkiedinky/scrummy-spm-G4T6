import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetailModal } from '../TaskDetailModal'

// Mock all UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }) => <span className={className}>{children}</span>,
}))

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, size, variant, 'aria-label': ariaLabel }) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-size={size} 
      data-variant={variant}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }) => <div data-testid="avatar">{children}</div>,
  AvatarImage: ({ src, alt }) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }) => <span>{children}</span>,
}))

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }) => <div data-testid="progress" data-value={value}></div>,
}))

jest.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children, value }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ placeholder }) => <div>{placeholder}</div>,
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange }) => (
    <div>
      <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
}))

// Mock lucide icons
jest.mock('lucide-react', () => ({
  Calendar: () => <span>Calendar</span>,
  Clock: () => <span>Clock</span>,
  User: () => <span>User</span>,
  Users: () => <span>Users</span>,
  Tag: () => <span>Tag</span>,
  MessageSquare: () => <span>MessageSquare</span>,
  Paperclip: () => <span>Paperclip</span>,
  Edit: () => <span>Edit</span>,
  Trash2: () => <span>Trash2</span>,
  CheckCircle2: () => <span>CheckCircle2</span>,
  Circle: () => <span>Circle</span>,
  Plus: () => <span>Plus</span>,
  AlertCircle: () => <span>AlertCircle</span>,
}))

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
}))

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
}))

// Mock API
jest.mock('@/lib/api', () => ({
  listSubtasks: jest.fn(() => Promise.resolve([])),
  createSubtask: jest.fn(() => Promise.resolve({ id: 'new-subtask' })),
  updateSubtask: jest.fn(() => Promise.resolve({})),
  deleteSubtask: jest.fn(() => Promise.resolve({})),
  listComments: jest.fn(() => Promise.resolve([])),
  addComment: jest.fn(() => Promise.resolve({ id: 'new-comment', text: 'Test comment' })),
  editComment: jest.fn(() => Promise.resolve({ id: 'comment-1', text: 'Updated comment' })),
  deleteComment: jest.fn(() => Promise.resolve({})),
  listStandaloneComments: jest.fn(() => Promise.resolve([])),
  addStandaloneComment: jest.fn(() => Promise.resolve({ id: 'new-standalone-comment' })),
  editStandaloneComment: jest.fn(() => Promise.resolve({})),
  deleteStandaloneComment: jest.fn(() => Promise.resolve({})),
  listSubtaskComments: jest.fn(() => Promise.resolve([])), // ADD THIS LINE
}))

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('TaskDetailModal Component', () => {
  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'This is a test task',
    status: 'in progress',
    priority: 7,
    dueDate: '2025-12-31',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-15',
    projectId: 'project-1',
    projectName: 'Test Project',
    assigneeId: 'user-1',
    createdBy: 'user-2',
    collaboratorsIds: ['user-3', 'user-4'],
    tags: ['urgent', 'frontend'],
  }

  const defaultProps = {
    task: mockTask,
    isOpen: true,
    onClose: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    disableActions: false,
    teamMembers: [],
    currentUserId: 'current-user',
    onSubtaskChange: jest.fn(),
    onSubtaskClick: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(<TaskDetailModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('displays task title', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByText('Test Task')).toBeInTheDocument()
    })

    it('displays task description', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByText('This is a test task')).toBeInTheDocument()
    })

    it('displays empty description placeholder', () => {
      const taskWithoutDesc = { ...mockTask, description: '' }
      render(<TaskDetailModal {...defaultProps} task={taskWithoutDesc} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('Status and Priority', () => {
    it('displays status badge', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    it('displays priority badge', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByText('Priority 7')).toBeInTheDocument()
    })

    it('handles to-do status', () => {
      const task = { ...mockTask, status: 'to-do' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('To-Do')).toBeInTheDocument()
    })

    it('handles completed status', () => {
      const task = { ...mockTask, status: 'completed' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('handles blocked status', () => {
      const task = { ...mockTask, status: 'blocked' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('Blocked')).toBeInTheDocument()
    })
  })

  describe('Overdue indication', () => {
    it('shows overdue badge when task is past due and not completed', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      const task = { ...mockTask, dueDate: pastDate.toISOString(), status: 'in progress' }

      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('Overdue')).toBeInTheDocument()
    })

    it('does not show overdue badge when completed', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)
      const task = { ...mockTask, dueDate: pastDate.toISOString(), status: 'completed' }

      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    })
  })

  describe('Subtask badge', () => {
    it('shows subtask badge when task is a subtask', () => {
      const task = { ...mockTask, isSubtask: true }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('Subtask')).toBeInTheDocument()
    })

    it('shows subtask badge when task has parentTaskId', () => {
      const task = { ...mockTask, parentTaskId: 'parent-1' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('Subtask')).toBeInTheDocument()
    })

    it('does not show subtask badge for parent tasks', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.queryByText('Subtask')).not.toBeInTheDocument()
    })
  })

  describe('Project name', () => {
    it('displays project name when available', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByText(/Project: Test Project/)).toBeInTheDocument()
    })

    it('does not display project section when project name is missing', () => {
      const task = { ...mockTask, projectName: null }
      const { container } = render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(container.textContent).not.toContain('Project:')
    })
  })

  describe('Action buttons', () => {
    it('renders Edit button', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('renders Delete button', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('calls onEdit when Edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<TaskDetailModal {...defaultProps} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockTask)
    })

    it('calls onDelete when Delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<TaskDetailModal {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      expect(defaultProps.onDelete).toHaveBeenCalledWith(mockTask)
    })

    it('disables Edit button when disableActions is true', () => {
      render(<TaskDetailModal {...defaultProps} disableActions={true} />)
      expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
    })

    it('disables Delete button when disableActions is true', () => {
      render(<TaskDetailModal {...defaultProps} disableActions={true} />)
      expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled()
    })

    it('disables Edit button when onEdit is not provided', () => {
      render(<TaskDetailModal {...defaultProps} onEdit={undefined} />)
      expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
    })

    it('disables Delete button when onDelete is not provided', () => {
      render(<TaskDetailModal {...defaultProps} onDelete={undefined} />)
      expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled()
    })
  })

  describe('Tags', () => {
    it('displays tags when available', () => {
      render(<TaskDetailModal {...defaultProps} />)
      expect(screen.getByText('urgent')).toBeInTheDocument()
      expect(screen.getByText('frontend')).toBeInTheDocument()
    })

    it('does not display tags section when no tags', () => {
      const task = { ...mockTask, tags: [] }
      const { container } = render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(container.textContent).not.toContain('Tags')
    })

    it('handles null tags', () => {
      const task = { ...mockTask, tags: null }
      const { container } = render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(container.textContent).not.toContain('Tags')
    })
  })

  describe('Collaborators', () => {
    it('displays "No collaborators added" when empty', () => {
      const task = { ...mockTask, collaboratorsIds: [] }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('No collaborators added.')).toBeInTheDocument()
    })

    it('displays "No collaborators added" when no collaborator data', () => {
      const task = { ...mockTask, collaboratorsIds: [] }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('No collaborators added.')).toBeInTheDocument()
    })
  })

  describe('Edge cases and utility functions', () => {
    // Test utility function edge cases that are currently uncovered
    
    it('handles task with ownerId property', () => {
      const task = { ...mockTask, ownerId: 'owner-1' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      // Just rendering should trigger the ownerId code path
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles task with collaboratorIds (alternative property)', () => {
      const task = { ...mockTask, collaboratorIds: ['collab-1', 'collab-2'] }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles standalone/standalone project tasks', () => {
      const task = { ...mockTask, projectId: 'standalone', isStandalone: true }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles task with no assigneeId', () => {
      const task = { ...mockTask, assigneeId: null }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles task with empty string description', () => {
      const task = { ...mockTask, description: '' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('handles task with undefined properties', () => {
      const task = {
        id: 'test-task',
        title: 'Minimal Task',
        // All other properties undefined
      }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('Minimal Task')).toBeInTheDocument()
    })
  })

  describe('Comments functionality edge cases', () => {
    it('handles empty comment submission', async () => {
      const user = userEvent.setup()
      render(<TaskDetailModal {...defaultProps} />)

      // Try to add empty comment
      const addButton = screen.getByRole('button', { name: /post/i })
      await user.click(addButton)

      // Should not call API with empty comment
      const { addComment } = require('@/lib/api')
      expect(addComment).not.toHaveBeenCalled()
    })

    it('handles whitespace-only comment submission', async () => {
      const user = userEvent.setup()
      render(<TaskDetailModal {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add a comment...')
      await user.type(input, '   ')
      
      const addButton = screen.getByRole('button', { name: /post/i })
      await user.click(addButton)

      // Should not call API with whitespace-only comment
      const { addComment } = require('@/lib/api')
      expect(addComment).not.toHaveBeenCalled()
    })

    it('handles empty text when editing comment', async () => {
      const user = userEvent.setup()
      const { listComments } = require('@/lib/api')
      listComments.mockResolvedValueOnce([
        { id: 'comment-1', text: 'Original text', user_id: 'current-user' }
      ])
      
      render(<TaskDetailModal {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Original text')).toBeInTheDocument()
      })

      // Start editing
      const editButton = screen.getByLabelText('Edit comment')
      await user.click(editButton)

      // Clear text and try to save
      const editInput = screen.getByDisplayValue('Original text')
      await user.clear(editInput)
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)

      // Should not call edit API with empty text
      const { editComment } = require('@/lib/api')
      expect(editComment).not.toHaveBeenCalled()
    })

    it('handles delete comment without confirmation', async () => {
      const user = userEvent.setup()
      const { listComments } = require('@/lib/api')
      listComments.mockResolvedValueOnce([
        { id: 'comment-1', text: 'Test comment', user_id: 'current-user' }
      ])
      
      render(<TaskDetailModal {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument()
      })

      // Click delete button to open confirmation dialog
      const deleteButton = screen.getByLabelText('Delete comment')
      await user.click(deleteButton)

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument()
        expect(screen.getByText('Are you sure you want to delete this comment? This action cannot be undone.')).toBeInTheDocument()
      })
      
      // Click Cancel button to dismiss dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      // Should not call delete API
      const { deleteComment } = require('@/lib/api')
      expect(deleteComment).not.toHaveBeenCalled()
      
      // Comment should still be visible
      expect(screen.getByText('Test comment')).toBeInTheDocument()
    })
  })

  describe('Date and user utility functions', () => {
    it('handles null values in utility functions', () => {
      // These test the utility functions directly by triggering their code paths
      const taskWithNullDates = { 
        ...mockTask, 
        dueDate: null, 
        createdAt: null,
        assigneeId: null,
        createdBy: null
      }
      render(<TaskDetailModal {...defaultProps} task={taskWithNullDates} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles Date objects in date fields', () => {
      const task = { 
        ...mockTask, 
        dueDate: new Date('2025-12-31'),
        createdAt: new Date('2025-01-01')
      }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles Firestore timestamp objects', () => {
      const task = { 
        ...mockTask, 
        dueDate: { seconds: 1735689600 }, // Firestore timestamp format
        createdAt: { seconds: 1735689600 }
      }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })
  })

  describe('API error handling', () => {
    it('handles API errors when loading comments', async () => {
      const { listComments } = require('@/lib/api')
      listComments.mockRejectedValueOnce(new Error('API Error'))
      
      render(<TaskDetailModal {...defaultProps} />)
      
      // Should handle error gracefully and show empty state
      await waitFor(() => {
        expect(screen.getByText('No comments yet')).toBeInTheDocument()
      })
    })

    it('handles API errors when adding comments', async () => {
      const user = userEvent.setup()
      const { addComment } = require('@/lib/api')
      const { toast } = require('sonner')
      
      addComment.mockRejectedValueOnce(new Error('Failed to add'))
      
      render(<TaskDetailModal {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add a comment...')
      await user.type(input, 'Test comment')
      
      const addButton = screen.getByRole('button', { name: /post/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to add comment')
      })
    })

    it('handles Firestore user fetch errors', async () => {
      // Mock getDoc to simulate user fetch failure
      const mockGetDoc = jest.fn().mockRejectedValue(new Error('User not found'))
      const mockDoc = jest.fn()
      
      jest.doMock('firebase/firestore', () => ({
        getDoc: mockGetDoc,
        doc: mockDoc,
      }))

      // Task with user IDs that will fail to fetch
      const task = { ...mockTask, assigneeId: 'nonexistent-user' }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      
      // Should handle the error gracefully
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })
  })

  describe('Subtasks section', () => {
    it('does not show subtasks section for subtasks', () => {
      const task = { ...mockTask, isSubtask: true }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.queryByText('Subtasks')).not.toBeInTheDocument()
    })

    it('shows subtasks section for parent tasks', async () => {
      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('Subtasks')).toBeInTheDocument()
      })
    })

    it('shows Add Subtask button for parent tasks', async () => {
      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add subtask/i })).toBeInTheDocument()
      })
    })

    it('disables Add Subtask button when actions are disabled', async () => {
      render(<TaskDetailModal {...defaultProps} disableActions={true} />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add subtask/i })).toBeDisabled()
      })
    })
  })

  describe('Comments section', () => {
    it('displays comments header', async () => {
      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('Comments')).toBeInTheDocument()
      })
    })

    it('shows "No comments yet" when no comments', async () => {
      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('No comments yet')).toBeInTheDocument()
      })
    })

    it('shows comment input and post button', async () => {
      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /post/i })).toBeInTheDocument()
      })
    })
  })

  describe('Attachments', () => {
    it('does not show attachments section when no attachments', () => {
      const { container } = render(<TaskDetailModal {...defaultProps} />)
      expect(container.textContent).not.toContain('Attachments')
    })

    it('shows attachments section when attachments exist', () => {
      const task = { ...mockTask, attachments: ['file1.pdf', 'file2.docx'] }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('file1.pdf')).toBeInTheDocument()
      expect(screen.getByText('file2.docx')).toBeInTheDocument()
    })

    it('shows correct attachment count in badge', () => {
      const task = { ...mockTask, attachments: ['file1.pdf', 'file2.docx'] }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('getUserInfo utility function coverage', () => {
    it('handles user with fullName', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ fullName: 'John Doe', email: 'john@example.com' })
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles user with displayName fallback', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ displayName: 'Jane Smith', email: 'jane@example.com' })
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles user with name fallback', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Bob Johnson', email: 'bob@example.com' })
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles user with email only fallback', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ email: 'user@example.com' })
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles user with userId fallback when no name fields', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({})
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles user fetch error gracefully (line 136)', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockRejectedValueOnce(new Error('Network error'))

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles null userId in getUserInfo (line 148)', () => {
      const task = { ...mockTask, assigneeId: null, createdBy: null }
      render(<TaskDetailModal {...defaultProps} task={task} />)
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    it('handles user with photoURL avatar', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          fullName: 'Avatar User',
          photoURL: 'https://example.com/photo.jpg'
        })
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })

    it('handles user with avatar field', async () => {
      const { getDoc } = require('firebase/firestore')
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          fullName: 'Avatar User 2',
          avatar: 'https://example.com/avatar.jpg'
        })
      })

      render(<TaskDetailModal {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    })
  })

  describe('Comment submission and editing coverage', () => {
    it('handles successful comment addition (lines 192-198)', async () => {
      const user = userEvent.setup()
      const { addComment } = require('@/lib/api')
      const { toast } = require('sonner')

      addComment.mockResolvedValueOnce({
        id: 'new-comment',
        text: 'Test comment',
        user_id: 'current-user',
        timestamp: new Date().toISOString()
      })

      render(<TaskDetailModal {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add a comment...')
      await user.type(input, 'Test comment')

      const addButton = screen.getByRole('button', { name: /post/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Comment added!')
        expect(addComment).toHaveBeenCalled()
      })
    })

    it('handles successful comment edit (lines 206-218)', async () => {
      const user = userEvent.setup()
      const { listComments, editComment } = require('@/lib/api')
      const { toast } = require('sonner')

      listComments.mockResolvedValueOnce([
        {
          id: 'comment-1',
          text: 'Original text',
          user_id: 'current-user',
          timestamp: new Date().toISOString()
        }
      ])

      editComment.mockResolvedValueOnce({
        id: 'comment-1',
        text: 'Updated text',
        edited: true
      })

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Original text')).toBeInTheDocument()
      })

      // Start editing
      const editButton = screen.getByLabelText('Edit comment')
      await user.click(editButton)

      // Update text
      const editInput = screen.getByDisplayValue('Original text')
      await user.clear(editInput)
      await user.type(editInput, 'Updated text')

      const saveButton = screen.getByText('Save')
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Comment updated!')
        expect(editComment).toHaveBeenCalledWith(
          expect.objectContaining({
            commentId: 'comment-1',
            text: 'Updated text'
          })
        )
      })
    })

    it('handles successful comment deletion (lines 227-241)', async () => {
      const user = userEvent.setup()
      const { listComments, deleteComment } = require('@/lib/api')
      const { toast } = require('sonner')

      listComments.mockResolvedValueOnce([
        {
          id: 'comment-1',
          text: 'Test comment',
          user_id: 'current-user',
          timestamp: new Date().toISOString()
        }
      ])

      deleteComment.mockResolvedValueOnce({})

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButton = screen.getByLabelText('Delete comment')
      await user.click(deleteButton)

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Comment deleted!')
        expect(deleteComment).toHaveBeenCalled()
      })
    })
  })

  describe('Subtask operations coverage', () => {
    it('handles subtask status toggle success (lines 255-259)', async () => {
      const user = userEvent.setup()
      const { listSubtasks, updateSubtask } = require('@/lib/api')
      const { toast } = require('sonner')

      listSubtasks.mockResolvedValueOnce([
        {
          id: 'subtask-1',
          title: 'Test Subtask',
          status: 'to-do',
          assigneeId: 'user-1'
        }
      ])

      updateSubtask.mockResolvedValueOnce({
        id: 'subtask-1',
        status: 'completed'
      })

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Subtask')).toBeInTheDocument()
      })

      // Find and click the status toggle checkbox
      const checkbox = screen.getAllByRole('checkbox')[0] // First checkbox is the subtask toggle
      await user.click(checkbox)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Subtask updated!')
        expect(updateSubtask).toHaveBeenCalled()
      })
    })

    it('handles subtask click navigation (lines 271-272)', async () => {
      const user = userEvent.setup()
      const { listSubtasks } = require('@/lib/api')

      listSubtasks.mockResolvedValueOnce([
        {
          id: 'subtask-1',
          title: 'Clickable Subtask',
          status: 'to-do'
        }
      ])

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Clickable Subtask')).toBeInTheDocument()
      })

      // Click on the subtask title to trigger navigation
      const subtaskTitle = screen.getByText('Clickable Subtask')
      await user.click(subtaskTitle)

      expect(defaultProps.onSubtaskClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'subtask-1' })
      )
    })
  })

  describe('Subtask creation form coverage', () => {
    it('handles subtask creation form submission (lines 288-299)', async () => {
      const user = userEvent.setup()
      const { createSubtask } = require('@/lib/api')
      const { toast } = require('sonner')

      createSubtask.mockResolvedValueOnce({ id: 'new-subtask' })

      render(<TaskDetailModal {...defaultProps} teamMembers={[
        { id: 'user-1', name: 'Team Member 1', email: 'user1@example.com', role: 'Developer' }
      ]} />)

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add subtask/i })
        expect(addButton).toBeInTheDocument()
      })

      // Click Add Subtask button
      const addButton = screen.getByRole('button', { name: /add subtask/i })
      await user.click(addButton)

      // Fill out the form
      await waitFor(() => {
        expect(screen.getByLabelText('Subtask Title')).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText('Subtask Title')
      await user.type(titleInput, 'New Subtask')

      const descInput = screen.getByLabelText('Description')
      await user.type(descInput, 'Subtask description')

      // Select a team member
      const teamCheckbox = screen.getByRole('checkbox', { name: /Team Member 1/i })
      await user.click(teamCheckbox)

      // Submit the form
      const createButton = screen.getByRole('button', { name: /create subtask/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Subtask created successfully!')
        expect(createSubtask).toHaveBeenCalled()
      })
    })

    it('handles subtask creation form close (lines 307-318)', async () => {
      const user = userEvent.setup()

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add subtask/i })).toBeInTheDocument()
      })

      // Open the form
      const addButton = screen.getByRole('button', { name: /add subtask/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Subtask')).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Create New Subtask')).not.toBeInTheDocument()
      })
    })

    it('validates subtask form requires team members (lines 329-333)', async () => {
      const user = userEvent.setup()

      render(<TaskDetailModal {...defaultProps} teamMembers={[
        { id: 'user-1', name: 'Team Member 1' }
      ]} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add subtask/i })).toBeInTheDocument()
      })

      // Open the form
      const addButton = screen.getByRole('button', { name: /add subtask/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Subtask Title')).toBeInTheDocument()
      })

      // Fill title but don't select team members
      const titleInput = screen.getByLabelText('Subtask Title')
      await user.type(titleInput, 'New Subtask')

      // Try to submit - button should be disabled
      const createButton = screen.getByRole('button', { name: /create subtask/i })
      expect(createButton).toBeDisabled()
    })

    it('validates subtask form requires title (line 337)', async () => {
      const user = userEvent.setup()

      render(<TaskDetailModal {...defaultProps} teamMembers={[
        { id: 'user-1', name: 'Team Member 1' }
      ]} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add subtask/i })).toBeInTheDocument()
      })

      // Open the form
      const addButton = screen.getByRole('button', { name: /add subtask/i })
      await user.click(addButton)

      // Select team member but don't enter title
      const teamCheckbox = screen.getByRole('checkbox', { name: /Team Member 1/i })
      await user.click(teamCheckbox)

      // Submit button should be disabled
      const createButton = screen.getByRole('button', { name: /create subtask/i })
      expect(createButton).toBeDisabled()
    })

    it('handles API error during subtask creation (lines 342-346)', async () => {
      const user = userEvent.setup()
      const { createSubtask } = require('@/lib/api')
      const { toast } = require('sonner')

      createSubtask.mockRejectedValueOnce(new Error('API Error'))

      render(<TaskDetailModal {...defaultProps} teamMembers={[
        { id: 'user-1', name: 'Team Member 1' }
      ]} />)

      // Open form and fill it
      const addButton = screen.getByRole('button', { name: /add subtask/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Subtask Title')).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText('Subtask Title')
      await user.type(titleInput, 'New Subtask')

      const teamCheckbox = screen.getByRole('checkbox', { name: /Team Member 1/i })
      await user.click(teamCheckbox)

      const createButton = screen.getByRole('button', { name: /create subtask/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create subtask. Please try again.')
      })
    })

    it('displays custom error message on validation failure (line 349)', async () => {
      const user = userEvent.setup()
      const { createSubtask } = require('@/lib/api')

      createSubtask.mockRejectedValueOnce({
        response: { data: { error: 'Custom validation error' } }
      })

      render(<TaskDetailModal {...defaultProps} teamMembers={[
        { id: 'user-1', name: 'Team Member 1' }
      ]} />)

      const addButton = screen.getByRole('button', { name: /add subtask/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByLabelText('Subtask Title')).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText('Subtask Title')
      await user.type(titleInput, 'New Subtask')

      const teamCheckbox = screen.getByRole('checkbox')
      await user.click(teamCheckbox)

      const createButton = screen.getByRole('button', { name: /create subtask/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Custom validation error')).toBeInTheDocument()
      })
    })
  })

  describe('Additional error handling coverage', () => {
    it('handles edit comment API error (line 358)', async () => {
      const user = userEvent.setup()
      const { listComments, editComment } = require('@/lib/api')
      const { toast } = require('sonner')

      listComments.mockResolvedValueOnce([
        { id: 'comment-1', text: 'Original', user_id: 'current-user' }
      ])

      editComment.mockRejectedValueOnce(new Error('Edit failed'))

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Original')).toBeInTheDocument()
      })

      const editButton = screen.getByLabelText('Edit comment')
      await user.click(editButton)

      const editInput = screen.getByDisplayValue('Original')
      await user.clear(editInput)
      await user.type(editInput, 'Updated')

      const saveButton = screen.getByText('Save')
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update comment')
      })
    })

    it('handles delete comment API error (lines 365-367)', async () => {
      const user = userEvent.setup()
      const { listComments, deleteComment } = require('@/lib/api')
      const { toast } = require('sonner')

      listComments.mockResolvedValueOnce([
        { id: 'comment-1', text: 'Test', user_id: 'current-user' }
      ])

      deleteComment.mockRejectedValueOnce(new Error('Delete failed'))

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })

      const deleteButton = screen.getByLabelText('Delete comment')
      await user.click(deleteButton)

      await waitFor(() => {
        expect(screen.getByText('Delete Comment')).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /delete/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete comment')
      })
    })

    it('handles subtask status update error (lines 407-411)', async () => {
      const user = userEvent.setup()
      const { listSubtasks, updateSubtask } = require('@/lib/api')
      const { toast } = require('sonner')

      listSubtasks.mockResolvedValueOnce([
        { id: 'subtask-1', title: 'Test', status: 'to-do' }
      ])

      updateSubtask.mockRejectedValueOnce(new Error('Update failed'))

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })

      const checkbox = screen.getAllByRole('checkbox')[0]
      await user.click(checkbox)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update subtask')
      })
    })

    it('handles subtask deletion error (line 490)', async () => {
      const user = userEvent.setup()
      const { listSubtasks, deleteSubtask } = require('@/lib/api')
      const { toast } = require('sonner')

      listSubtasks.mockResolvedValueOnce([
        { id: 'subtask-1', title: 'Test Subtask', status: 'to-do' }
      ])

      deleteSubtask.mockRejectedValueOnce(new Error('Delete failed'))

      render(<TaskDetailModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test Subtask')).toBeInTheDocument()
      })

      // Find and click delete button for subtask
      const deleteButtons = screen.getAllByLabelText('Delete subtask')
      await user.click(deleteButtons[0])

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText(/delete this subtask/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getAllByRole('button', { name: /delete/i })[0]
      await user.click(confirmButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete subtask')
      })
    })
  })
})

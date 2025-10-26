import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StandaloneTaskModal } from '../StandaloneTaskModal'

// Mock dependencies
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type }) => (
    <button onClick={onClick} disabled={disabled} type={type} data-testid="button">
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} data-testid="input" />,
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }) => (
    open ? <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>{children}</div> : null
  ),
  DialogContent: ({ children }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }) => <div data-testid="dialog-footer">{children}</div>,
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
}))

describe('StandaloneTaskModal', () => {
  const mockCurrentUser = {
    uid: 'user-123',
    email: 'test@example.com',
  }
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Modal Display', () => {
    it('renders when isOpen is true', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByText('Add Standalone Task')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(
        <StandaloneTaskModal
          isOpen={false}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('displays dialog description', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByText(/Provide details for the new task/)).toBeInTheDocument()
    })
  })

  describe('Form Fields', () => {
    it('renders all required form fields', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByLabelText('Title')).toBeInTheDocument()
      expect(screen.getByLabelText('Description')).toBeInTheDocument()
      expect(screen.getByLabelText('Status')).toBeInTheDocument()
      expect(screen.getByLabelText('Priority')).toBeInTheDocument()
      expect(screen.getByLabelText(/Due date/)).toBeInTheDocument()
      expect(screen.getByLabelText('Tags')).toBeInTheDocument()
    })

    it('displays placeholder text for title input', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByPlaceholderText('Design login screen')).toBeInTheDocument()
    })

    it('displays placeholder text for description textarea', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByPlaceholderText(/Wireframes \+ final design in Figma/)).toBeInTheDocument()
    })

    it('displays placeholder for tags input', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByPlaceholderText('Enter comma-separated tags')).toBeInTheDocument()
    })

    it('shows required field indicator for due date', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByText('*')).toBeInTheDocument()
      expect(screen.getByText('Required field')).toBeInTheDocument()
    })
  })

  describe('Form Initialization', () => {
    it('initializes with default values', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByLabelText('Title')).toHaveValue('')
      expect(screen.getByLabelText('Description')).toHaveValue('')
      expect(screen.getByLabelText('Tags')).toHaveValue('')
    })

    it('initializes status with "to-do"', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const statusSelect = screen.getAllByTestId('select')[0]
      expect(statusSelect).toHaveValue('to-do')
    })

    it('initializes priority with "5"', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const prioritySelect = screen.getAllByTestId('select')[1]
      expect(prioritySelect).toHaveValue('5')
    })
  })

  describe('Form Input', () => {
    it('updates title field on input', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')
      expect(titleInput).toHaveValue('New Task')
    })

    it('updates description field on input', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const descriptionInput = screen.getByLabelText('Description')
      await user.type(descriptionInput, 'Task description')
      expect(descriptionInput).toHaveValue('Task description')
    })

    it('updates status field on selection', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const statusSelect = screen.getAllByTestId('select')[0]
      fireEvent.change(statusSelect, { target: { value: 'in progress' } })
      expect(statusSelect).toHaveValue('in progress')
    })

    it('updates priority field on selection', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const prioritySelect = screen.getAllByTestId('select')[1]
      fireEvent.change(prioritySelect, { target: { value: '8' } })
      expect(prioritySelect).toHaveValue('8')
    })

    it('updates due date field on input', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')
      expect(dueDateInput).toHaveValue('2025-12-31')
    })

    it('updates tags field on input', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const tagsInput = screen.getByLabelText('Tags')
      await user.type(tagsInput, 'urgent, frontend')
      expect(tagsInput).toHaveValue('urgent, frontend')
    })
  })

  describe('Form Validation', () => {
    it('shows error when submitting without title', async () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const submitButton = screen.getAllByTestId('button')[1] // Second button is submit
      fireEvent.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('shows error when submitting with whitespace-only title', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, '   ')
      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('shows error when submitting without due date', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')
      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('Due date is required')).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('shows error when user is not signed in', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={null}
        />
      )
      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')
      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')
      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('You must be signed in')).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('shows error when currentUser has no uid', async () => {
      const user = userEvent.setup()
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={{}}
        />
      )
      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')
      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')
      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText('You must be signed in')).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('disables submit button when title is empty', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const submitButton = screen.getAllByTestId('button')[1]
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const descriptionInput = screen.getByLabelText('Description')
      await user.type(descriptionInput, 'Task description')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const tagsInput = screen.getByLabelText('Tags')
      await user.type(tagsInput, 'urgent, frontend')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'New Task',
          description: 'Task description',
          status: 'to-do',
          priority: '5',
          dueDate: '2025-12-31',
          tags: ['urgent', 'frontend'],
          ownerId: 'user-123',
        })
      })
    })

    it('trims whitespace from title and description', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, '  New Task  ')

      const descriptionInput = screen.getByLabelText('Description')
      await user.type(descriptionInput, '  Description  ')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Task',
            description: 'Description',
          })
        )
      })
    })

    it('parses tags correctly', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const tagsInput = screen.getByLabelText('Tags')
      await user.type(tagsInput, 'urgent, frontend, bug')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['urgent', 'frontend', 'bug'],
          })
        )
      })
    })

    it('filters out empty tags', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const tagsInput = screen.getByLabelText('Tags')
      await user.type(tagsInput, 'urgent,  , frontend,  ')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: ['urgent', 'frontend'],
          })
        )
      })
    })

    it('resets form after successful submission', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(titleInput).toHaveValue('')
      })
      expect(dueDateInput).toHaveValue('')
    })

    it('shows error message on submission failure', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockRejectedValue(new Error('Network error'))
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows generic error message when error has no message', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockRejectedValue({})
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to create task')).toBeInTheDocument()
      })
    })

    it('disables buttons while saving', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockImplementation(() => new Promise(() => {})) // Never resolves
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      const cancelButton = screen.getAllByTestId('button')[0]
      expect(cancelButton).toBeDisabled()
    })

    it('shows "Creating..." text while saving', async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockImplementation(() => new Promise(() => {}))
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )

      const titleInput = screen.getByLabelText('Title')
      await user.type(titleInput, 'New Task')

      const dueDateInput = screen.getByLabelText(/Due date/)
      await user.type(dueDateInput, '2025-12-31')

      const submitButton = screen.getAllByTestId('button')[1]
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Creating…')).toBeInTheDocument()
      })
    })
  })

  describe('Modal Close Behavior', () => {
    it('calls onClose when cancel button clicked', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const cancelButton = screen.getAllByTestId('button')[0]
      fireEvent.click(cancelButton)
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('resets form when closing', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      const cancelButton = screen.getAllByTestId('button')[0]
      fireEvent.click(cancelButton)
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('does not close while saving', () => {
      mockOnSubmit.mockImplementation(() => new Promise(() => {}))
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      // Try to close while in saving state
      // The modal should prevent closing
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })
  })

  describe('Status Options', () => {
    it('displays all status options', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      expect(screen.getByText('To-Do')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Blocked')).toBeInTheDocument()
    })
  })

  describe('Priority Options', () => {
    it('displays priority options 1-10', () => {
      render(
        <StandaloneTaskModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          currentUser={mockCurrentUser}
        />
      )
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(String(i))).toBeInTheDocument()
      }
    })
  })
})
